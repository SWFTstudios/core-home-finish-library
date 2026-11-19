import { DEPARTMENTS } from "./auth-policy";
import type { SessionProfile } from "./auth";
import {
  BUILT_IN_ACCESS,
  atLeast,
  canManageAccess,
  cleanAccessMap,
  resolveAccess,
  type AccessLevel,
  type AccessMap,
} from "./request-access";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const STATUSES = ["Draft", "Submitted", "In Progress", "Delivered", "Revision Requested"];
const MAX_FINISHES = 20;
const MAX_COMMENT = 2000;

type Selection = { finish_id: string; zone: string; notes?: string };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function accessMapFromRows(rows: { department: string; level: AccessLevel }[]): AccessMap {
  const map: AccessMap = {};
  for (const row of rows) map[row.department] = row.level;
  return map;
}

async function loadAccess(db: D1Database, requestId: string): Promise<AccessMap> {
  const { results } = await db
    .prepare("SELECT department, level FROM request_access WHERE request_id = ?")
    .bind(requestId)
    .all<{ department: string; level: AccessLevel }>();
  return accessMapFromRows(results ?? []);
}

/** The preparer's saved defaults, or the built-in ones until they save their own. */
async function loadDefaults(
  db: D1Database,
  profileId: string,
): Promise<{ access: AccessMap; saved: boolean }> {
  const marker = await db
    .prepare("SELECT request_access_set_at AS at FROM profiles WHERE id = ?")
    .bind(profileId)
    .first<{ at: string | null }>();
  if (!marker?.at) return { access: { ...BUILT_IN_ACCESS }, saved: false };
  const { results } = await db
    .prepare("SELECT department, level FROM profile_request_access_defaults WHERE profile_id = ?")
    .bind(profileId)
    .all<{ department: string; level: AccessLevel }>();
  return { access: accessMapFromRows(results ?? []), saved: true };
}

function accessInserts(db: D1Database, requestId: string, access: AccessMap): D1PreparedStatement[] {
  return Object.entries(access).map(([department, level]) =>
    db
      .prepare("INSERT INTO request_access (request_id, department, level) VALUES (?, ?, ?)")
      .bind(requestId, department, level),
  );
}

function cleanSelections(input: unknown): Selection[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > MAX_FINISHES) return null;
  const ok = input.every(
    (s) => s && typeof s.finish_id === "string" && s.finish_id && typeof s.zone === "string" && s.zone,
  );
  return ok ? (input as Selection[]) : null;
}

function selectionInserts(db: D1Database, requestId: string, selections: Selection[]): D1PreparedStatement[] {
  return selections.map((s) =>
    db
      .prepare("INSERT INTO request_finishes (id, request_id, finish_id, zone, notes) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), requestId, s.finish_id, s.zone, s.notes ?? null),
  );
}

/** Run a batch; an unknown finish id becomes a 400 and nothing is saved. */
async function runBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<Response | null> {
  try {
    await db.batch(statements);
    return null;
  } catch (err) {
    if (String(err).includes("FOREIGN KEY")) {
      return json({ error: "One of the selected finishes does not exist" }, 400);
    }
    throw err;
  }
}

interface RequestRow {
  id: string;
  title: string;
  product_type: string | null;
  requested_by: string | null;
  status: string;
  notes: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Request, finish-selection, comment and access routes. Returns null for paths it does not own.
 * A request the viewer cannot see answers 404, so its existence is not revealed.
 */
export async function handleRequestsApi(
  request: Request,
  env: { DB: D1Database },
  url: URL,
  profile: SessionProfile,
): Promise<Response | null> {
  const db = env.DB;
  const path = url.pathname;
  const method = request.method;

  // ---- The preparer's saved defaults (settings page) ----
  if (path === "/api/me/request-access") {
    if (method === "GET") {
      const { access, saved } = await loadDefaults(db, profile.id);
      return json({ access, saved, departments: DEPARTMENTS });
    }
    if (method === "PUT") {
      const body = await readBody(request);
      const { value, errors } = cleanAccessMap(body?.access, DEPARTMENTS);
      if (errors.length) return json({ error: errors.join(". ") }, 400);
      await db.batch([
        db.prepare("DELETE FROM profile_request_access_defaults WHERE profile_id = ?").bind(profile.id),
        ...Object.entries(value).map(([department, level]) =>
          db
            .prepare("INSERT INTO profile_request_access_defaults (profile_id, department, level) VALUES (?, ?, ?)")
            .bind(profile.id, department, level),
        ),
        db
          .prepare("UPDATE profiles SET request_access_set_at = ?, updated_at = ? WHERE id = ?")
          .bind(new Date().toISOString(), new Date().toISOString(), profile.id),
      ]);
      return json({ access: value, saved: true });
    }
    return json({ error: "Method not allowed" }, 405);
  }

  // ---- Collection ----
  if (path === "/api/requests" && method === "GET") {
    const status = url.searchParams.get("status");
    const isAdmin = profile.team === "Admin" ? 1 : 0;
    // Only requests the viewer prepared, that their department can see, or (Admin) everything.
    let query = `SELECT * FROM (
        SELECT r.id, r.title, r.product_type, r.status, r.deadline, r.created_at, r.updated_at,
               r.requested_by,
               CASE WHEN r.requested_by = ?1 OR ?2 = 1 THEN 'edit'
                    ELSE (SELECT a.level FROM request_access a
                          WHERE a.request_id = r.id AND a.department = ?3) END AS access
        FROM render_requests r
      ) WHERE access IS NOT NULL`;
    const binds: (string | number | null)[] = [profile.id, isAdmin, profile.department ?? null];
    if (status) {
      query += " AND status = ?4";
      binds.push(status);
    }
    query += " ORDER BY updated_at DESC";
    const { results } = await db.prepare(query).bind(...binds).all();
    return json({ requests: results ?? [] });
  }

  if (path === "/api/requests" && method === "POST") {
    const body = await readBody(request);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return json({ error: "title is required" }, 400);

    // Requesters may only save a draft or submit; later statuses belong to the render teams.
    const status = (body?.status as string | undefined) ?? "Draft";
    if (status !== "Draft" && status !== "Submitted") {
      return json({ error: "status must be Draft or Submitted" }, 400);
    }
    const selections = cleanSelections(body?.finishes);
    if (!selections) {
      return json({ error: `finishes need a finish_id and zone each (max ${MAX_FINISHES})` }, 400);
    }

    let access: AccessMap;
    if (body?.access === undefined) {
      access = (await loadDefaults(db, profile.id)).access;
    } else {
      const cleaned = cleanAccessMap(body.access, DEPARTMENTS);
      if (cleaned.errors.length) return json({ error: cleaned.errors.join(". ") }, 400);
      access = cleaned.value;
    }

    const requestId = crypto.randomUUID();
    const failed = await runBatch(db, [
      db
        .prepare(
          `INSERT INTO render_requests (id, title, product_type, requested_by, status, notes, deadline)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          requestId,
          title,
          typeof body?.product_type === "string" ? body.product_type.trim() || null : null,
          profile.id,
          status,
          typeof body?.notes === "string" ? body.notes.trim() || null : null,
          typeof body?.deadline === "string" ? body.deadline || null : null,
        ),
      ...accessInserts(db, requestId, access),
      ...selectionInserts(db, requestId, selections),
    ]);
    if (failed) return failed;
    return json({ id: requestId, status, access }, 201);
  }

  // ---- One request ----
  const match = path.match(/^\/api\/requests\/([A-Za-z0-9-]+)(?:\/(comments|access))?$/);
  if (!match) return null;
  const [, requestId, sub] = match;

  const row = await db
    .prepare("SELECT * FROM render_requests WHERE id = ?")
    .bind(requestId)
    .first<RequestRow>();
  const access = row ? await loadAccess(db, requestId) : {};
  const level = row ? resolveAccess(profile, row.requested_by, access) : null;
  if (!row || !level) return json({ error: "Request not found" }, 404);

  if (!sub && method === "GET") {
    const [finishes, comments] = await Promise.all([
      db
        .prepare(
          `SELECT rf.id, rf.finish_id, rf.zone, rf.notes, f.name AS finish_name, f.category
           FROM request_finishes rf LEFT JOIN finishes f ON f.id = rf.finish_id
           WHERE rf.request_id = ? ORDER BY rf.zone`,
        )
        .bind(requestId)
        .all(),
      db
        .prepare(
          `SELECT c.id, c.body, c.created_at, p.full_name AS author_name, p.department AS author_department
           FROM request_comments c LEFT JOIN profiles p ON p.id = c.author_id
           WHERE c.request_id = ? ORDER BY c.created_at ASC`,
        )
        .bind(requestId)
        .all(),
    ]);
    const manage = canManageAccess(profile, row.requested_by);
    return json({
      request: row,
      finishes: finishes.results ?? [],
      comments: comments.results ?? [],
      my_access: level,
      can_manage_access: manage,
      // Who else can see it is the preparer's business; collaborators only see their own level.
      access: manage ? access : undefined,
    });
  }

  if (!sub && method === "PATCH") {
    if (!atLeast(level, "edit")) return json({ error: "You can view this request but not edit it" }, 403);
    const body = await readBody(request);
    if (!body) return json({ error: "Send a JSON body" }, 400);

    const sets: string[] = [];
    const binds: (string | null)[] = [];
    if ("title" in body) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return json({ error: "title cannot be empty" }, 400);
      sets.push("title = ?");
      binds.push(title);
    }
    for (const key of ["product_type", "notes", "deadline"] as const) {
      if (key in body) {
        const v = body[key];
        if (v !== null && typeof v !== "string") return json({ error: `${key} must be text` }, 400);
        sets.push(`${key} = ?`);
        binds.push(v ? v.trim() || null : null);
      }
    }
    if ("status" in body) {
      if (typeof body.status !== "string" || !STATUSES.includes(body.status)) {
        return json({ error: `status must be one of ${STATUSES.join(", ")}` }, 400);
      }
      sets.push("status = ?");
      binds.push(body.status);
    }
    let selections: Selection[] | undefined;
    if ("finishes" in body) {
      const cleaned = cleanSelections(body.finishes);
      if (!cleaned) return json({ error: `finishes need a finish_id and zone each (max ${MAX_FINISHES})` }, 400);
      selections = cleaned;
    }
    if (!sets.length && !selections) return json({ error: "Nothing to update" }, 400);

    sets.push("updated_at = datetime('now')");
    const failed = await runBatch(db, [
      db.prepare(`UPDATE render_requests SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, requestId),
      ...(selections
        ? [db.prepare("DELETE FROM request_finishes WHERE request_id = ?").bind(requestId)]
        : []),
      ...(selections ? selectionInserts(db, requestId, selections) : []),
    ]);
    if (failed) return failed;
    return json({ ok: true });
  }

  if (sub === "comments" && method === "POST") {
    if (!atLeast(level, "comment")) return json({ error: "You can view this request but not comment on it" }, 403);
    const body = await readBody(request);
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) return json({ error: "Write a comment first" }, 400);
    if (text.length > MAX_COMMENT) return json({ error: `Comments are limited to ${MAX_COMMENT} characters` }, 400);
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO request_comments (id, request_id, author_id, body) VALUES (?, ?, ?, ?)")
      .bind(id, requestId, profile.id, text)
      .run();
    return json({ id }, 201);
  }

  if (sub === "access" && method === "PUT") {
    if (!canManageAccess(profile, row.requested_by)) {
      return json({ error: "Only the person who prepared this request can change who has access" }, 403);
    }
    const body = await readBody(request);
    const { value, errors } = cleanAccessMap(body?.access, DEPARTMENTS);
    if (errors.length) return json({ error: errors.join(". ") }, 400);
    await db.batch([
      db.prepare("DELETE FROM request_access WHERE request_id = ?").bind(requestId),
      ...accessInserts(db, requestId, value),
    ]);
    return json({ access: value });
  }

  return json({ error: "Method not allowed" }, 405);
}

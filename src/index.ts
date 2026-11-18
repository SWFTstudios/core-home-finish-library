export interface Env {
  DB: D1Database;
  RENDERS?: R2Bucket;
  STATIC_ASSETS: Fetcher;
}

type Team = "PD" | "ID" | "GD" | "Admin";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  team: Team;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

async function enableForeignKeys(db: D1Database): Promise<void> {
  await db.prepare("PRAGMA foreign_keys = ON").run();
}

async function getProfile(
  db: D1Database,
  email: string,
): Promise<Profile | null> {
  const row = await db
    .prepare("SELECT id, email, full_name, team FROM profiles WHERE email = ?")
    .bind(email)
    .first<Profile>();
  return row ?? null;
}

function resolveUserEmail(request: Request, url: URL): string | null {
  const accessEmail = request.headers.get(
    "Cf-Access-Authenticated-User-Email",
  );
  if (accessEmail) return accessEmail;

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return url.searchParams.get("dev_email") ?? "pd@corehome.internal";
  }

  return null;
}

async function uploadRender(
  env: Env,
  file: File,
  requestId: string,
): Promise<string> {
  if (!env.RENDERS) {
    throw new Error("R2 storage is not configured");
  }
  const key = `renders/${requestId}/${crypto.randomUUID()}-${file.name}`;
  await env.RENDERS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return key;
}

/** Trailing-slash paths → index.html (Pages does this automatically; Worker assets do not). */
function assetRequestForPath(request: Request, pathname: string): Request {
  if (!pathname.endsWith("/")) {
    return request;
  }
  const url = new URL(request.url);
  url.pathname = `${pathname}index.html`;
  return new Request(url.toString(), request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (request.method === "GET") {
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(`${url.origin}/configurator/`, 302);
      }

      if (url.pathname === "/configurator") {
        return Response.redirect(`${url.origin}/configurator/`, 302);
      }
    }

    return env.STATIC_ASSETS.fetch(assetRequestForPath(request, url.pathname));
  },
};

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  await enableForeignKeys(env.DB);

  if (url.pathname === "/api/health") {
    return Response.json({ ok: true, service: "render-portal" }, { headers: JSON_HEADERS });
  }

  const isPublicCatalog =
    request.method === "GET" && url.pathname === "/api/catalog";

  const email = resolveUserEmail(request, url);
  if (!email && !isPublicCatalog) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = email ? await getProfile(env.DB, email) : null;
  if (!profile && !isPublicCatalog && url.pathname !== "/api/health") {
    return Response.json(
      { error: "No profile found for authenticated user" },
      { status: 403, headers: JSON_HEADERS },
    );
  }

  if (request.method === "GET" && url.pathname === "/api/me") {
    return Response.json({ profile }, { headers: JSON_HEADERS });
  }

  if (request.method === "GET" && url.pathname === "/api/catalog") {
    const material = url.searchParams.get("material") ?? "stainless_steel";

    const materials = await env.DB.prepare(
      "SELECT id, slug, label, enabled, sort_order AS sortOrder FROM material_types ORDER BY sort_order ASC",
    ).all();

    const graphicApplicationTypes = await env.DB.prepare(
      `SELECT id, template_key AS templateKey, label, ui_label AS uiLabel,
              material_slug AS materialSlug, sort_order AS sortOrder
       FROM graphic_application_types
       WHERE material_slug = ?
       ORDER BY sort_order ASC`,
    )
      .bind(material)
      .all();

    const finishesResult = await env.DB.prepare(
      `SELECT id, slug, material_slug AS materialSlug, name, category,
              durability_score AS durabilityScore, durability_notes AS durabilityNotes,
              price_band AS priceBand, cost_tier AS costTier, finish_process AS finishProcess,
              process_steps AS processSteps, description, hex_color AS hexColor,
              image_url AS imageUrl, extensions
       FROM finishes
       WHERE template_id = 'finish_library_ak' AND material_slug = ?
       ORDER BY name ASC`,
    )
      .bind(material)
      .all();

    const compatResult = await env.DB.prepare(
      `SELECT finish_id, graphic_id FROM finish_graphic_compat WHERE compatible = 1`,
    ).all();

    const compatByFinish = new Map<string, string[]>();
    for (const row of compatResult.results ?? []) {
      const r = row as { finish_id: string; graphic_id: string };
      const list = compatByFinish.get(r.finish_id) ?? [];
      list.push(r.graphic_id);
      compatByFinish.set(r.finish_id, list);
    }

    const finishes = (finishesResult.results ?? []).map((row) => {
      const { extensions, ...f } = row as Record<string, unknown>;
      const id = String(f.id);
      let details: Record<string, unknown> = {};
      if (typeof extensions === "string" && extensions) {
        try {
          details = JSON.parse(extensions) as Record<string, unknown>;
        } catch {
          details = {};
        }
      }
      return {
        ...f,
        ...details,
        compatibleGraphics: compatByFinish.get(id) ?? [],
      };
    });

    return Response.json(
      {
        templateId: "finish_library_ak",
        material,
        materials: materials.results ?? [],
        graphicApplicationTypes: graphicApplicationTypes.results ?? [],
        finishes,
      },
      { headers: JSON_HEADERS },
    );
  }

  if (request.method === "GET" && url.pathname === "/api/finishes") {
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q");

    let query = "SELECT * FROM finishes";
    const binds: string[] = [];
    const clauses: string[] = [];

    if (category) {
      clauses.push("category = ?");
      binds.push(category);
    }
    if (q) {
      clauses.push("(name LIKE ? OR description LIKE ?)");
      binds.push(`%${q}%`, `%${q}%`);
    }
    if (clauses.length) query += ` WHERE ${clauses.join(" AND ")}`;
    query += " ORDER BY name ASC";

    const stmt = env.DB.prepare(query);
    const result = await (binds.length ? stmt.bind(...binds) : stmt).all();
    return Response.json({ finishes: result.results ?? [] }, { headers: JSON_HEADERS });
  }

  if (request.method === "GET" && url.pathname === "/api/requests") {
    const status = url.searchParams.get("status");
    let query =
      "SELECT id, title, product_type, status, deadline, created_at, updated_at FROM render_requests";
    const binds: string[] = [];

    if (status) {
      query += " WHERE status = ?";
      binds.push(status);
    }
    query += " ORDER BY updated_at DESC";

    const stmt = env.DB.prepare(query);
    const result = await (binds.length ? stmt.bind(...binds) : stmt).all();
    return Response.json({ requests: result.results ?? [] }, { headers: JSON_HEADERS });
  }

  const requestDetailMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (request.method === "GET" && requestDetailMatch) {
    const requestId = requestDetailMatch[1];
    const row = await env.DB.prepare(
      `SELECT rr.id, rr.title, rr.product_type, rr.status, rr.notes, rr.deadline,
              rr.material_slug, rr.graphic_application_id, rr.source, rr.spec_snapshot,
              rr.created_at, rr.updated_at,
              p.id AS requester_id, p.email AS requester_email,
              p.full_name AS requester_name, p.team AS requester_team,
              g.ui_label AS graphic_label, g.template_key AS graphic_template_key,
              g.label AS graphic_name,
              mt.label AS material_label
       FROM render_requests rr
       LEFT JOIN profiles p ON p.id = rr.requested_by
       LEFT JOIN graphic_application_types g ON g.id = rr.graphic_application_id
       LEFT JOIN material_types mt ON mt.slug = rr.material_slug
       WHERE rr.id = ?`,
    )
      .bind(requestId)
      .first<Record<string, unknown>>();

    if (!row) {
      return Response.json(
        { error: "Request not found" },
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const finishesResult = await env.DB.prepare(
      `SELECT rf.id, rf.zone, rf.notes AS selection_notes,
              f.id AS finish_id, f.slug, f.material_slug, f.name, f.category,
              f.description, f.hex_color, f.image_url,
              f.durability_score, f.durability_notes, f.price_band, f.cost_tier,
              f.finish_process
       FROM request_finishes rf
       JOIN finishes f ON f.id = rf.finish_id
       WHERE rf.request_id = ?
       ORDER BY CASE rf.zone WHEN 'body' THEN 0 WHEN 'logo' THEN 1 WHEN 'accent' THEN 2 ELSE 3 END`,
    )
      .bind(requestId)
      .all();

    const rendersResult = await env.DB.prepare(
      `SELECT r.id, r.file_url, r.version, r.notes, r.created_at,
              p.full_name AS uploaded_by_name, p.team AS uploaded_by_team
       FROM renders r
       LEFT JOIN profiles p ON p.id = r.uploaded_by
       WHERE r.request_id = ?
       ORDER BY r.version ASC`,
    )
      .bind(requestId)
      .all();

    const finishes = finishesResult.results ?? [];

    let spec_snapshot: unknown = null;
    if (row.spec_snapshot && typeof row.spec_snapshot === "string") {
      try {
        spec_snapshot = JSON.parse(row.spec_snapshot);
      } catch {
        spec_snapshot = null;
      }
    }

    return Response.json(
      {
        request: {
          id: row.id,
          title: row.title,
          product_type: row.product_type,
          status: row.status,
          notes: row.notes,
          deadline: row.deadline,
          material_slug: row.material_slug,
          material_label: row.material_label,
          graphic_application_id: row.graphic_application_id,
          graphic: row.graphic_application_id
            ? {
                id: row.graphic_application_id,
                label: row.graphic_label ?? row.graphic_name,
                template_key: row.graphic_template_key,
              }
            : null,
          source: row.source,
          spec_snapshot,
          created_at: row.created_at,
          updated_at: row.updated_at,
          requested_by: row.requester_id
            ? {
                id: row.requester_id,
                email: row.requester_email,
                full_name: row.requester_name,
                team: row.requester_team,
              }
            : null,
          finishes,
          renders: rendersResult.results ?? [],
        },
      },
      { headers: JSON_HEADERS },
    );
  }

  if (request.method === "POST" && url.pathname === "/api/requests") {
    if (profile?.team !== "PD" && profile?.team !== "Admin") {
      return Response.json(
        { error: "Only PD or Admin can create requests" },
        { status: 403, headers: JSON_HEADERS },
      );
    }

    const body = (await request.json()) as {
      title?: string;
      product_type?: string;
      notes?: string;
      deadline?: string;
      status?: string;
      material_slug?: string;
      graphic_application_id?: string;
      source?: string;
      spec_snapshot?: unknown;
      finishes?: { finish_id: string; zone: string; notes?: string }[];
    };

    if (!body.title?.trim()) {
      return Response.json(
        { error: "title is required" },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const requestId = crypto.randomUUID();
    const status = body.status ?? "Draft";
    const source =
      body.source === "configurator" || body.source === "request_form"
        ? body.source
        : "request_form";
    const specSnapshotJson =
      body.spec_snapshot != null ? JSON.stringify(body.spec_snapshot) : null;

    await env.DB.prepare(
      `INSERT INTO render_requests (
         id, title, product_type, requested_by, status, notes, deadline,
         material_slug, graphic_application_id, source, spec_snapshot
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        requestId,
        body.title.trim(),
        body.product_type ?? null,
        profile!.id,
        status,
        body.notes ?? null,
        body.deadline ?? null,
        body.material_slug ?? null,
        body.graphic_application_id ?? null,
        source,
        specSnapshotJson,
      )
      .run();

    for (const selection of body.finishes ?? []) {
      await env.DB.prepare(
        `INSERT INTO request_finishes (id, request_id, finish_id, zone, notes)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          requestId,
          selection.finish_id,
          selection.zone,
          selection.notes ?? null,
        )
        .run();
    }

    return Response.json({ id: requestId, status }, { status: 201, headers: JSON_HEADERS });
  }

  if (request.method === "POST" && url.pathname === "/api/renders/upload") {
    if (!env.RENDERS) {
      return Response.json(
        { error: "R2 storage is not configured for this environment" },
        { status: 503, headers: JSON_HEADERS },
      );
    }

    if (profile?.team !== "ID" && profile?.team !== "Admin") {
      return Response.json(
        { error: "Only ID or Admin can upload renders" },
        { status: 403, headers: JSON_HEADERS },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const requestId = form.get("request_id");

    if (
      typeof requestId !== "string" ||
      typeof file !== "object" ||
      file === null ||
      !("stream" in file) ||
      !("name" in file) ||
      !("type" in file)
    ) {
      return Response.json(
        { error: "file and request_id are required" },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const key = await uploadRender(env, file as File, requestId);
    const renderId = crypto.randomUUID();

    const versionRow = await env.DB.prepare(
      "SELECT COALESCE(MAX(version), 0) AS max_version FROM renders WHERE request_id = ?",
    )
      .bind(requestId)
      .first<{ max_version: number }>();

    const version = (versionRow?.max_version ?? 0) + 1;

    await env.DB.prepare(
      `INSERT INTO renders (id, request_id, uploaded_by, file_url, version, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        renderId,
        requestId,
        profile!.id,
        key,
        version,
        (form.get("notes") as string) ?? null,
      )
      .run();

    return Response.json(
      { id: renderId, file_url: key, version },
      { status: 201, headers: JSON_HEADERS },
    );
  }

  if (url.pathname.startsWith("/api/folder")) {
    return handleFolderApi(request, env, url, profile!);
  }

  return new Response("Not Found", { status: 404 });
}

interface FolderItemRow {
  id: string;
  folder_id: string;
  material_slug: string;
  finish_id: string;
  graphic_application_id: string | null;
  spec_snapshot: string;
  notes: string | null;
  selected_for_review: number;
  sort_order: number;
  created_at: string;
}

function parseFolderItemRow(row: FolderItemRow) {
  let snap: Record<string, unknown> = {};
  try {
    snap = JSON.parse(row.spec_snapshot) as Record<string, unknown>;
  } catch {
    snap = {};
  }
  return {
    id: row.id,
    material_slug: row.material_slug,
    finish_id: row.finish_id,
    graphic_application_id: row.graphic_application_id,
    notes: row.notes ?? "",
    selected_for_review: row.selected_for_review !== 0,
    sort_order: row.sort_order,
    created_at: row.created_at,
    spec_snapshot: snap,
    material_label: snap.material_label ?? null,
    finish_name: snap.finish_name ?? null,
    finish_slug: snap.finish_slug ?? null,
    graphic_label: snap.graphic_label ?? null,
    durability_score: snap.durability_score ?? null,
    cost_tier: snap.cost_tier ?? null,
    preview_front_url: snap.preview_front_url ?? null,
    preview_back_url: snap.preview_back_url ?? null,
    combo_image_url: snap.combo_image_url ?? null,
  };
}

async function getOrCreateDefaultFolder(
  db: D1Database,
  profileId: string,
): Promise<{ id: string; name: string }> {
  const existing = await db
    .prepare("SELECT id, name FROM saved_folders WHERE profile_id = ? ORDER BY created_at ASC LIMIT 1")
    .bind(profileId)
    .first<{ id: string; name: string }>();

  if (existing) return existing;

  const folderId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO saved_folders (id, profile_id, name) VALUES (?, ?, 'My folder')`,
    )
    .bind(folderId, profileId)
    .run();

  return { id: folderId, name: "My folder" };
}

async function handleFolderApi(
  request: Request,
  env: Env,
  url: URL,
  profile: Profile,
): Promise<Response> {
  const folderItemMatch = url.pathname.match(/^\/api\/folder\/items\/([^/]+)$/);

  if (request.method === "GET" && url.pathname === "/api/folder") {
    const folder = await getOrCreateDefaultFolder(env.DB, profile.id);
    const itemsResult = await env.DB.prepare(
      `SELECT id, folder_id, material_slug, finish_id, graphic_application_id,
              spec_snapshot, notes, selected_for_review, sort_order, created_at
       FROM saved_folder_items
       WHERE folder_id = ?
       ORDER BY sort_order ASC, created_at DESC`,
    )
      .bind(folder.id)
      .all();

    const items = (itemsResult.results ?? []).map((row) =>
      parseFolderItemRow(row as FolderItemRow),
    );

    return Response.json({ folder, items }, { headers: JSON_HEADERS });
  }

  if (request.method === "POST" && url.pathname === "/api/folder/items") {
    const body = (await request.json()) as {
      spec_snapshot?: Record<string, unknown>;
    };

    const snap = body.spec_snapshot;
    if (!snap?.finish_id || !snap?.material_slug) {
      return Response.json(
        { error: "spec_snapshot with finish_id and material_slug is required" },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const folder = await getOrCreateDefaultFolder(env.DB, profile.id);
    const finishId = String(snap.finish_id);
    const graphicId = snap.graphic_application_id
      ? String(snap.graphic_application_id)
      : null;

    const dup = await env.DB.prepare(
      `SELECT id FROM saved_folder_items
       WHERE folder_id = ? AND finish_id = ?
         AND COALESCE(graphic_application_id, '') = COALESCE(?, '')`,
    )
      .bind(folder.id, finishId, graphicId)
      .first();

    if (dup) {
      return Response.json(
        { error: "This finish and graphic combo is already in your folder." },
        { status: 409, headers: JSON_HEADERS },
      );
    }

    const itemId = crypto.randomUUID();
    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM saved_folder_items WHERE folder_id = ?",
    )
      .bind(folder.id)
      .first<{ c: number }>();

    await env.DB.prepare(
      `INSERT INTO saved_folder_items (
         id, folder_id, material_slug, finish_id, graphic_application_id,
         spec_snapshot, notes, selected_for_review, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        itemId,
        folder.id,
        String(snap.material_slug),
        finishId,
        graphicId,
        JSON.stringify(snap),
        typeof snap.notes === "string" ? snap.notes : "",
        snap.selected_for_review === false ? 0 : 1,
        countRow?.c ?? 0,
      )
      .run();

    await env.DB.prepare(
      "UPDATE saved_folders SET updated_at = datetime('now') WHERE id = ?",
    )
      .bind(folder.id)
      .run();

    const row = await env.DB.prepare(
      `SELECT id, folder_id, material_slug, finish_id, graphic_application_id,
              spec_snapshot, notes, selected_for_review, sort_order, created_at
       FROM saved_folder_items WHERE id = ?`,
    )
      .bind(itemId)
      .first<FolderItemRow>();

    return Response.json(
      { item: parseFolderItemRow(row!) },
      { status: 201, headers: JSON_HEADERS },
    );
  }

  if (folderItemMatch) {
    const itemId = folderItemMatch[1];
    const folder = await getOrCreateDefaultFolder(env.DB, profile.id);

    const existing = await env.DB.prepare(
      "SELECT id FROM saved_folder_items WHERE id = ? AND folder_id = ?",
    )
      .bind(itemId, folder.id)
      .first();

    if (!existing) {
      return Response.json(
        { error: "Folder item not found" },
        { status: 404, headers: JSON_HEADERS },
      );
    }

    if (request.method === "PATCH") {
      const body = (await request.json()) as {
        notes?: string;
        selected_for_review?: boolean;
      };

      const updates: string[] = [];
      const binds: (string | number)[] = [];

      if (body.notes !== undefined) {
        updates.push("notes = ?");
        binds.push(body.notes);
      }
      if (body.selected_for_review !== undefined) {
        updates.push("selected_for_review = ?");
        binds.push(body.selected_for_review ? 1 : 0);
      }

      if (!updates.length) {
        return Response.json(
          { error: "No valid fields to update" },
          { status: 400, headers: JSON_HEADERS },
        );
      }

      binds.push(itemId);
      await env.DB.prepare(
        `UPDATE saved_folder_items SET ${updates.join(", ")} WHERE id = ?`,
      )
        .bind(...binds)
        .run();

      const row = await env.DB.prepare(
        `SELECT id, folder_id, material_slug, finish_id, graphic_application_id,
                spec_snapshot, notes, selected_for_review, sort_order, created_at
         FROM saved_folder_items WHERE id = ?`,
      )
        .bind(itemId)
        .first<FolderItemRow>();

      return Response.json(
        { item: parseFolderItemRow(row!) },
        { headers: JSON_HEADERS },
      );
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM saved_folder_items WHERE id = ?").bind(itemId).run();
      await env.DB.prepare(
        "UPDATE saved_folders SET updated_at = datetime('now') WHERE id = ?",
      )
        .bind(folder.id)
        .run();
      return new Response(null, { status: 204 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

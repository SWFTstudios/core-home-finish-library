export interface Env {
  DB: D1Database;
  RENDERS: R2Bucket;
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

  const email = resolveUserEmail(request, url);
  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await getProfile(env.DB, email);
  if (!profile && url.pathname !== "/api/health") {
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
      `SELECT id, template_key AS templateKey, label, ui_label AS uiLabel, sort_order AS sortOrder
       FROM graphic_application_types ORDER BY sort_order ASC`,
    ).all();

    const finishesResult = await env.DB.prepare(
      `SELECT id, slug, name, category, durability_score AS durabilityScore, durability_notes AS durabilityNotes,
              price_band AS priceBand, cost_tier AS costTier, finish_process AS finishProcess,
              process_steps AS processSteps, description, hex_color AS hexColor
       FROM finishes WHERE template_id = 'finish_library_ak' ORDER BY name ASC`,
    ).all();

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
      const f = row as Record<string, unknown>;
      const id = String(f.id);
      return {
        ...f,
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

    await env.DB.prepare(
      `INSERT INTO render_requests (id, title, product_type, requested_by, status, notes, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        requestId,
        body.title.trim(),
        body.product_type ?? null,
        profile!.id,
        status,
        body.notes ?? null,
        body.deadline ?? null,
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

  return new Response("Not Found", { status: 404 });
}

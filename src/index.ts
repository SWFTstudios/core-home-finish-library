import { currentProfile, handleAuthApi, handleMeApi, type AuthEnv, type SessionProfile } from "./auth";
import { isPublicPath, safeNextPath } from "./auth-policy";
import { handleRequestsApi } from "./requests";

export interface Env extends AuthEnv {
  /** Optional at runtime: branch preview builds run without the D1 binding. */
  DB?: D1Database;
  RENDERS?: R2Bucket;
  STATIC_ASSETS: Fetcher;
}

type Profile = SessionProfile;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

async function enableForeignKeys(db: D1Database): Promise<void> {
  await db.prepare("PRAGMA foreign_keys = ON").run();
}

/**
 * The catalog bundled with the static assets (public/api/catalog.json, same data as D1, all
 * materials; the client filters by material). Used when D1 is not bound — Workers Builds branch
 * previews — or a D1 query fails, so the configurator still loads instead of showing nothing.
 */
async function staticCatalog(request: Request, env: Env, url: URL, reason: string): Promise<Response> {
  const assetUrl = new URL("/api/catalog.json", url.origin);
  const res = await env.STATIC_ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET", headers: request.headers }));
  if (!res.ok) {
    return Response.json({ error: `Catalog unavailable (${reason})` }, { status: 503, headers: JSON_HEADERS });
  }
  const data = (await res.json()) as Record<string, unknown>;
  const material = url.searchParams.get("material") ?? (data.material as string) ?? "stainless_steel";
  return Response.json(
    { ...data, material },
    { headers: { ...JSON_HEADERS, "X-Catalog-Source": `static (${reason})` } },
  );
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

function redirect(url: URL, path: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${url.origin}${path}`, "Cache-Control": "no-store" } });
}

function wantsPage(request: Request, pathname: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (pathname.endsWith("/") || pathname.endsWith(".html")) return true;
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

function unavailable(message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Core Home</title><body style="font-family:system-ui;padding:48px;max-width:560px;margin:auto"><h1 style="font-size:22px">Sign-in unavailable</h1><p>${message}</p></body>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/login" || path === "/welcome" || path === "/settings")) {
      return redirect(url, `${path}/${url.search}`);
    }

    // Public: the sign-in page, its scripts and styles, and the auth endpoints.
    if (isPublicPath(path)) {
      if (path.startsWith("/api/")) return handleApi(request, env, url, null);
      if (path.startsWith("/login") && env.DB) {
        // Already signed in? Skip the form.
        const me = await currentProfile(request, env.DB);
        if (me) return redirect(url, safeNextPath(url.searchParams.get("next")));
      }
      return env.STATIC_ASSETS.fetch(assetRequestForPath(request, path));
    }

    if (!env.DB) {
      return wantsPage(request, path)
        ? unavailable("This copy of the Finish Library has no database, so nobody can sign in. Use the production site.")
        : Response.json({ error: "Sign-in unavailable" }, { status: 503, headers: JSON_HEADERS });
    }

    const profile = await currentProfile(request, env.DB);
    if (!profile) {
      if (path.startsWith("/api/")) {
        return Response.json({ error: "Sign in required" }, { status: 401, headers: JSON_HEADERS });
      }
      if (wantsPage(request, path)) {
        const next = path === "/" ? "" : `?next=${encodeURIComponent(path + url.search)}`;
        return redirect(url, `/login/${next}`);
      }
      return new Response("Sign in required", { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    if (path.startsWith("/api/")) return handleApi(request, env, url, profile);

    // First sign-in: set up the profile before anything else.
    if (!profile.full_name && wantsPage(request, path) && !path.startsWith("/welcome")) {
      return redirect(url, `/welcome/?next=${encodeURIComponent(path + url.search)}`);
    }

    if (request.method === "GET" && (path === "/" || path === "" || path === "/configurator")) {
      return redirect(url, "/configurator/");
    }

    const res = await env.STATIC_ASSETS.fetch(assetRequestForPath(request, path));
    // Signed-in pages must not be cached by shared caches.
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  },
};

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
  profile: Profile | null,
): Promise<Response> {
  if (url.pathname === "/api/health") {
    return Response.json({ ok: true, service: "render-portal", database: Boolean(env.DB) }, { headers: JSON_HEADERS });
  }
  if (!env.DB) {
    return Response.json(
      { error: "Database not available in this environment" },
      { status: 503, headers: JSON_HEADERS },
    );
  }
  const db = env.DB;
  if (url.pathname.startsWith("/api/auth/")) {
    try {
      return (await handleAuthApi(request, env as Env & { DB: D1Database }, url)) ??
        Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
    } catch (err) {
      // Most often: the sign-in tables are missing (run `npm run db:migrate:auth`).
      console.error("[auth] sign-in failed", err);
      return Response.json(
        { error: "Sign-in isn’t available right now. Please try again shortly or contact the Finish Library team." },
        { status: 503, headers: JSON_HEADERS },
      );
    }
  }
  if (!profile) {
    return Response.json({ error: "Sign in required" }, { status: 401, headers: JSON_HEADERS });
  }
  if (url.pathname === "/api/me/request-access") {
    return (await handleRequestsApi(request, env as Env & { DB: D1Database }, url, profile)) ??
      Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
  }
  if (url.pathname === "/api/me" || url.pathname.startsWith("/api/me/")) {
    return (await handleMeApi(request, db, url, profile)) ??
      Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
  }
  const isCatalog = request.method === "GET" && url.pathname === "/api/catalog";
  if (isCatalog) {
    try {
      return await handleDbApi(request, env as Env & { DB: D1Database }, url, profile);
    } catch (err) {
      console.error("D1 catalog failed, serving static catalog", err);
      return staticCatalog(request, env, url, "database error");
    }
  }
  if (url.pathname === "/api/catalog.json") {
    return env.STATIC_ASSETS.fetch(request);
  }
  return handleDbApi(request, env as Env & { DB: D1Database }, url, profile);
}

async function handleDbApi(
  request: Request,
  env: Env & { DB: D1Database },
  url: URL,
  profile: Profile,
): Promise<Response> {
  await enableForeignKeys(env.DB);

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

  const requestsResponse = await handleRequestsApi(request, env, url, profile);
  if (requestsResponse) return requestsResponse;

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

  return new Response("Not Found", { status: 404 });
}

/**
 * Email sign-in for Core Home staff: a 6-digit code is emailed to an @corehome.com address,
 * and a correct code starts a 30-day session held in an HttpOnly cookie. Profiles are created
 * on first sign-in; the person fills in their name and team on /welcome/.
 */
import {
  CODE_MAX_ATTEMPTS,
  CODE_MAX_PER_HOUR,
  CODE_MIN_GAP_MS,
  CODE_TTL_MS,
  DEFAULT_ALLOWED_DOMAIN,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  cleanProfileInput,
  clearSessionCookie,
  generateCode,
  generateToken,
  hashCode,
  hashToken,
  isAllowedEmail,
  normalizeEmail,
  readCookie,
  safeEqual,
  sessionCookie,
} from "./auth-policy";

export interface AuthEnv {
  DB?: D1Database;
  EMAIL?: SendEmail;
  /** Sender shown on the code email, e.g. "Core Home Finish Library <no-reply@swftstudios.com>". */
  AUTH_EMAIL_FROM?: string;
  /** Company email domain allowed to sign in (default corehome.com). */
  ALLOWED_EMAIL_DOMAIN?: string;
  /** "1" in .dev.vars: return the code in the response on localhost instead of emailing it. */
  DEV_SHOW_CODES?: string;
}

export interface SessionProfile {
  id: string;
  email: string;
  full_name: string | null;
  team: string | null;
  department: string | null;
  job_title: string | null;
  onboarding_completed_at: string | null;
  created_at: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TEAM_BY_DEPARTMENT: Record<string, string> = {
  "Product Development": "PD",
  "Industrial Design": "ID",
  "Graphic Design": "GD",
};
const PROFILE_COLUMNS =
  "id, email, full_name, team, department, job_title, onboarding_completed_at, created_at";

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...JSON_HEADERS, ...extra } });
}

function allowedDomain(env: AuthEnv): string {
  return (env.ALLOWED_EMAIL_DOMAIN || DEFAULT_ALLOWED_DOMAIN).trim().toLowerCase();
}

function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The signed-in person for this request, or null. Refreshes the session's last-seen time. */
export async function currentProfile(request: Request, db: D1Database): Promise<SessionProfile | null> {
  const token = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const id = await hashToken(token);
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT s.expires_at AS expires_at, s.last_seen_at AS last_seen_at, ${PROFILE_COLUMNS
        .split(", ")
        .map((c) => `p.${c} AS ${c}`)
        .join(", ")}
       FROM sessions s JOIN profiles p ON p.id = s.profile_id
       WHERE s.id = ?`,
    )
    .bind(id)
    .first<SessionProfile & { expires_at: number; last_seen_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  // Touch at most every 10 minutes to keep writes low.
  if (now - (row.last_seen_at ?? 0) > 10 * 60 * 1000) {
    await db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, id).run();
  }
  const { expires_at: _e, last_seen_at: _l, ...profile } = row;
  return profile;
}

function codeEmail(code: string): { subject: string; text: string; html: string } {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${spaced} is your Core Home sign-in code`,
    text: [
      `Your Core Home Finish Library sign-in code is ${code}.`,
      "",
      "It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111c2d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:18px;font-weight:600;padding-bottom:24px">Core Home</td></tr>
<tr><td style="font-size:16px;line-height:24px;padding-bottom:16px">Here is your code to sign in to the Finish Library:</td></tr>
<tr><td style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0 24px;font-family:Menlo,Consolas,monospace">${spaced}</td></tr>
<tr><td style="font-size:14px;line-height:20px;color:#434655">It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

async function requestCode(request: Request, env: AuthEnv & { DB: D1Database }, url: URL): Promise<Response> {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  const domain = allowedDomain(env);
  if (!isAllowedEmail(email, domain)) {
    return json({ error: `Use your @${domain} email address to sign in.`, code: "domain" }, 403);
  }

  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n, MAX(created_at) AS last FROM auth_codes WHERE email = ? AND created_at > ?",
  )
    .bind(email, now - 60 * 60 * 1000)
    .first<{ n: number; last: number | null }>();
  if (recent && recent.last && now - recent.last < CODE_MIN_GAP_MS) {
    const wait = Math.ceil((CODE_MIN_GAP_MS - (now - recent.last)) / 1000);
    return json({ error: `Please wait ${wait} seconds before asking for another code.`, retryAfter: wait }, 429);
  }
  if (recent && recent.n >= CODE_MAX_PER_HOUR) {
    return json({ error: "Too many codes requested. Try again in an hour." }, 429);
  }

  const code = generateCode();
  await env.DB.batch([
    // Only the newest code for an address works.
    env.DB.prepare("UPDATE auth_codes SET used_at = ? WHERE email = ? AND used_at IS NULL").bind(now, email),
    env.DB.prepare(
      "INSERT INTO auth_codes (id, email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    ).bind(crypto.randomUUID(), email, await hashCode(email, code), now + CODE_TTL_MS, now),
    env.DB.prepare("DELETE FROM auth_codes WHERE created_at < ?").bind(now - 24 * 60 * 60 * 1000),
  ]);

  if (isLocal(url) && env.DEV_SHOW_CODES === "1") {
    console.log(`[auth] sign-in code for ${email}: ${code}`);
    return json({ ok: true, email, devCode: code });
  }
  if (!env.EMAIL || !env.AUTH_EMAIL_FROM) {
    console.error("[auth] EMAIL binding or AUTH_EMAIL_FROM is not configured");
    return json({ error: "Email sign-in isn't set up on this server yet." }, 503);
  }
  try {
    const message = codeEmail(code);
    await env.EMAIL.send({ from: env.AUTH_EMAIL_FROM, to: email, ...message });
  } catch (err) {
    console.error("[auth] sending the code failed", err);
    return json({ error: "We couldn't send the email. Try again in a minute." }, 502);
  }
  return json({ ok: true, email });
}

async function verifyCode(request: Request, env: AuthEnv & { DB: D1Database }): Promise<Response> {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || !isAllowedEmail(email, allowedDomain(env)) || code.length !== 6) {
    return json({ error: "Enter the 6-digit code from the email." }, 400);
  }
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT id, code_hash, expires_at, attempts FROM auth_codes
     WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at <= now) {
    return json({ error: "That code has expired. Send a new one.", code: "expired" }, 400);
  }
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    return json({ error: "Too many wrong tries. Send a new code.", code: "locked" }, 429);
  }
  if (!safeEqual(await hashCode(email, code), row.code_hash)) {
    await env.DB.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
    return json(
      { error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code.", code: left > 0 ? "wrong" : "locked" },
      400,
    );
  }

  let profile = await env.DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE email = ?`)
    .bind(email)
    .first<SessionProfile>();
  const nowIso = new Date(now).toISOString();
  if (!profile) {
    await env.DB.prepare("INSERT INTO profiles (id, email, created_at, last_sign_in_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), email, nowIso, nowIso)
      .run();
    profile = await env.DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE email = ?`)
      .bind(email)
      .first<SessionProfile>();
  }
  if (!profile) return json({ error: "Could not create your profile." }, 500);

  const token = generateToken();
  await env.DB.batch([
    env.DB.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").bind(now, row.id),
    env.DB.prepare("UPDATE profiles SET last_sign_in_at = ? WHERE id = ?").bind(nowIso, profile.id),
    env.DB.prepare(
      "INSERT INTO sessions (id, profile_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      await hashToken(token),
      profile.id,
      now,
      now + SESSION_TTL_MS,
      now,
      (request.headers.get("User-Agent") ?? "").slice(0, 200),
    ),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
  ]);

  return json(
    { ok: true, profile, needsProfile: !profile.full_name },
    200,
    { "Set-Cookie": sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)) },
  );
}

async function signOut(request: Request, env: AuthEnv & { DB: D1Database }): Promise<Response> {
  const token = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashToken(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

/** /api/auth/* — public endpoints (they work without a session). */
export async function handleAuthApi(
  request: Request,
  env: AuthEnv & { DB: D1Database },
  url: URL,
): Promise<Response | null> {
  if (request.method !== "POST") {
    if (url.pathname.startsWith("/api/auth/")) return json({ error: "Method not allowed" }, 405);
    return null;
  }
  // Cross-site form posts can't start or end a session.
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({ error: "Bad origin" }, 403);
  if (url.pathname === "/api/auth/request-code") return requestCode(request, env, url);
  if (url.pathname === "/api/auth/verify") return verifyCode(request, env);
  if (url.pathname === "/api/auth/sign-out") return signOut(request, env);
  return null;
}

/** /api/me — the signed-in person's own profile and onboarding state. */
export async function handleMeApi(
  request: Request,
  db: D1Database,
  url: URL,
  profile: SessionProfile,
): Promise<Response | null> {
  if (url.pathname === "/api/me" && request.method === "GET") {
    return json({ profile });
  }
  if (url.pathname === "/api/me" && (request.method === "PATCH" || request.method === "POST")) {
    const { value, errors } = cleanProfileInput(await readJson(request));
    if (errors.length) return json({ error: errors.join(". ") }, 400);
    // The team drives permissions (PD creates requests, ID uploads renders); Admins keep theirs.
    if ("department" in value && profile.team !== "Admin") {
      value.team = TEAM_BY_DEPARTMENT[value.department ?? ""] ?? null;
    }
    const keys = Object.keys(value);
    if (keys.length) {
      await db
        .prepare(`UPDATE profiles SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
        .bind(...keys.map((k) => value[k]), new Date().toISOString(), profile.id)
        .run();
    }
    const updated = await db.prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = ?`).bind(profile.id).first();
    return json({ profile: updated });
  }
  if (url.pathname === "/api/me/onboarding" && request.method === "POST") {
    const body = await readJson(request);
    const done = body.completed !== false;
    await db
      .prepare("UPDATE profiles SET onboarding_completed_at = ?, updated_at = ? WHERE id = ?")
      .bind(done ? new Date().toISOString() : null, new Date().toISOString(), profile.id)
      .run();
    return json({ ok: true, onboarding_completed_at: done ? "set" : null });
  }
  if (url.pathname === "/api/me/sessions" && request.method === "DELETE") {
    // Sign out everywhere.
    await db.prepare("DELETE FROM sessions WHERE profile_id = ?").bind(profile.id).run();
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }
  return null;
}

/**
 * Sign-in rules with no I/O, so they can be unit tested in Node (type stripping) and reused by
 * the Worker. Who may sign in, how codes and session tokens are made and hashed, cookie syntax,
 * and which paths stay public.
 */

export const DEFAULT_ALLOWED_DOMAIN = "corehome.com";
export const SESSION_COOKIE = "ch_session";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
/** Codes one address may request per hour, and the minimum gap between two requests. */
export const CODE_MAX_PER_HOUR = 5;
export const CODE_MIN_GAP_MS = 30 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const DEPARTMENTS = [
  "Product Development",
  "Industrial Design",
  "Graphic Design",
  "Visualization",
  "Sales",
  "Merchandising",
  "Sourcing",
  "Other",
] as const;

/** Trim and lower-case an address; null when it is not a plausible single address. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  // One @, a non-empty local part, no spaces or angle brackets, a dotted domain.
  if (!/^[^\s@<>()",;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) {
    return null;
  }
  return email;
}

/**
 * True when the address belongs to the company domain: exactly `@corehome.com`.
 * Look-alikes such as `x@corehome.com.evil.io` or `x@notcorehome.com` are refused.
 */
export function isAllowedEmail(email: string | null, domain: string = DEFAULT_ALLOWED_DOMAIN): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;
  return email.slice(at + 1) === domain.trim().toLowerCase();
}

/** A uniformly random 6-digit code, as a string with leading zeros kept. */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  // Rejection sampling keeps every code equally likely.
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** 32 random bytes, base64url: the session token kept only in the visitor's cookie. */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Codes are stored hashed together with the address they were sent to. */
export function hashCode(email: string, code: string): Promise<string> {
  return sha256Hex(`code:${email}:${code}`);
}

export function hashToken(token: string): Promise<string> {
  return sha256Hex(`session:${token}`);
}

/** Constant-time string compare for equal-length hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Paths anyone may load without signing in: the sign-in page and the code it needs. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/login/" || pathname === "/login/index.html") return true;
  if (pathname === "/favicon.ico" || pathname === "/404.html") return true;
  if (pathname === "/api/health" || pathname.startsWith("/api/auth/")) return true;
  return ["/css/", "/js/", "/vendor/", "/assets/brand/"].some((p) => pathname.startsWith(p));
}

/** Only same-site relative paths are followed after sign-in (no open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/configurator/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/configurator/";
  if (next.startsWith("/login") || next.startsWith("/api/")) return "/configurator/";
  return next;
}

/** Profile fields a person may edit about themselves, cleaned; errors name the field. */
export function cleanProfileInput(body: unknown): { value: Record<string, string | null>; errors: string[] } {
  const errors: string[] = [];
  const value: Record<string, string | null> = {};
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const text = (key: string, max: number, required: boolean) => {
    if (!(key in src)) return;
    const raw = src[key];
    const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
    if (!s) {
      if (required) errors.push(`${key} is required`);
      else value[key] = null;
      return;
    }
    if (s.length > max) errors.push(`${key} must be ${max} characters or fewer`);
    else value[key] = s;
  };
  text("full_name", 80, true);
  text("job_title", 80, false);
  if ("department" in src) {
    const d = src.department;
    if (d === null || d === "") value.department = null;
    else if (typeof d === "string" && (DEPARTMENTS as readonly string[]).includes(d)) value.department = d;
    else errors.push("department is not one of the listed teams");
  }
  return { value, errors };
}

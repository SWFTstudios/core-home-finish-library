/**
 * Client side of sign-in: who is signed in, profile updates, onboarding state and sign-out.
 * The session itself is an HttpOnly cookie the browser sends on every same-origin request.
 */

export const DEPARTMENTS = [
  "Product Development",
  "Industrial Design",
  "Graphic Design",
  "Visualization",
  "Sales",
  "Merchandising",
  "Sourcing",
  "Other",
];

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

let mePromise = null;

/** The signed-in profile, or null when signed out. Cached for the page's lifetime. */
export function getMe({ refresh = false } = {}) {
  if (refresh || !mePromise) {
    mePromise = call("/api/me")
      .then((d) => d.profile ?? null)
      .catch((err) => {
        if (err.status === 401) return null;
        throw err;
      });
  }
  return mePromise;
}

export async function updateMe(fields) {
  const { profile } = await call("/api/me", { method: "PATCH", body: fields });
  mePromise = Promise.resolve(profile);
  return profile;
}

export function setOnboardingComplete(completed = true) {
  return call("/api/me/onboarding", { method: "POST", body: { completed } });
}

export const requestCode = (email) => call("/api/auth/request-code", { method: "POST", body: { email } });
export const verifyCode = (email, code) => call("/api/auth/verify", { method: "POST", body: { email, code } });

export async function signOut({ everywhere = false } = {}) {
  try {
    if (everywhere) await call("/api/me/sessions", { method: "DELETE" });
    else await call("/api/auth/sign-out", { method: "POST" });
  } finally {
    mePromise = null;
    window.location.assign("/login/");
  }
}

export function initials(profile) {
  const name = (profile?.full_name || "").trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  return (profile?.email?.[0] ?? "?").toUpperCase();
}

export function firstName(profile) {
  return (profile?.full_name || "").trim().split(/\s+/)[0] || "";
}

/** Apply the saved light/dark choice on pages without the navbar (sign-in, setup). */
export function applyStoredTheme() {
  let mode = null;
  try {
    mode = localStorage.getItem("luminaTheme");
  } catch {
    /* storage blocked */
  }
  if (mode !== "light" && mode !== "dark") {
    mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.luminaTheme = mode;
}

/** Same-site path to continue to after sign-in (mirrors the Worker's rule). */
export function nextPath(defaultPath = "/configurator/") {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return defaultPath;
  if (next.startsWith("/login") || next.startsWith("/api/")) return defaultPath;
  return next;
}

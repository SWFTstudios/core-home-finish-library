import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanProfileInput,
  generateCode,
  generateToken,
  hashCode,
  isAllowedEmail,
  isPublicPath,
  normalizeEmail,
  readCookie,
  safeEqual,
  safeNextPath,
  sessionCookie,
} from "../src/auth-policy.ts";

test("only exact @corehome.com addresses may sign in", () => {
  const ok = (e: string) => isAllowedEmail(normalizeEmail(e));
  assert.equal(ok("Maria.Tovar@CoreHome.com "), true);
  assert.equal(ok("dani@corehome.com"), true);
  assert.equal(ok("x@corehome.com.evil.io"), false);
  assert.equal(ok("x@notcorehome.com"), false);
  assert.equal(ok("x@sub.corehome.com"), false);
  assert.equal(ok("corehome.com@gmail.com"), false);
  assert.equal(ok("a@b@corehome.com"), false);
  assert.equal(ok("<x@corehome.com>"), false);
  assert.equal(ok(""), false);
  assert.equal(isAllowedEmail("x@acme.co", "acme.co"), true);
});

test("codes are 6 digits and tokens are long and random", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateCode();
    assert.match(c, /^\d{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 190);
  const t = generateToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(t, generateToken());
});

test("code hashes are bound to the address", async () => {
  const a = await hashCode("a@corehome.com", "123456");
  assert.equal(a, await hashCode("a@corehome.com", "123456"));
  assert.notEqual(a, await hashCode("b@corehome.com", "123456"));
  assert.equal(safeEqual(a, a), true);
  assert.equal(safeEqual(a, a.replace(/.$/, "0") === a ? a.replace(/.$/, "1") : a.replace(/.$/, "0")), false);
});

test("session cookie is HttpOnly, Secure and Lax, and parses back", () => {
  const c = sessionCookie("tok", 60);
  assert.match(c, /HttpOnly/);
  assert.match(c, /Secure/);
  assert.match(c, /SameSite=Lax/);
  assert.equal(readCookie("theme=dark; ch_session=tok; x=1", "ch_session"), "tok");
  assert.equal(readCookie("ch_sessionx=bad", "ch_session"), null);
  assert.equal(readCookie(null, "ch_session"), null);
});

test("only the sign-in page and static code are public", () => {
  for (const p of ["/login/", "/js/auth/login.js", "/css/auth.css", "/assets/brand/core-home-logo.svg", "/api/auth/verify", "/api/health"]) {
    assert.equal(isPublicPath(p), true, p);
  }
  for (const p of ["/configurator/", "/api/catalog", "/api/catalog.json", "/data/finish-render.json", "/assets/ceramic/thumb.png", "/settings/", "/welcome/"]) {
    assert.equal(isPublicPath(p), false, p);
  }
});

test("next= only follows same-site paths", () => {
  assert.equal(safeNextPath("/library.html?x=1"), "/library.html?x=1");
  assert.equal(safeNextPath("//evil.com"), "/configurator/");
  assert.equal(safeNextPath("https://evil.com"), "/configurator/");
  assert.equal(safeNextPath("/\\evil.com"), "/configurator/");
  assert.equal(safeNextPath("/login/"), "/configurator/");
  assert.equal(safeNextPath(null), "/configurator/");
});

test("profile input is trimmed and checked", () => {
  assert.deepEqual(cleanProfileInput({ full_name: "  Erin   Effinger ", department: "Sales", job_title: "" }), {
    value: { full_name: "Erin Effinger", department: "Sales", job_title: null },
    errors: [],
  });
  assert.equal(cleanProfileInput({ full_name: "" }).errors.length, 1);
  assert.equal(cleanProfileInput({ department: "Hackers" }).errors.length, 1);
  assert.equal(cleanProfileInput({ full_name: "x".repeat(81) }).errors.length, 1);
  assert.deepEqual(cleanProfileInput({ email: "boss@corehome.com" }).value, {});
});

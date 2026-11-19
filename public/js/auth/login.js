import { applyStoredTheme, nextPath, requestCode, verifyCode } from "../session.js";

applyStoredTheme();

const DOMAIN = "corehome.com";
const RESEND_SECONDS = 30;

const $ = (id) => document.getElementById(id);
const stepEmail = $("step-email");
const stepCode = $("step-code");
const emailInput = $("email");
const codeInput = $("code");
const emailError = $("email-error");
const codeError = $("code-error");
const emailSubmit = $("email-submit");
const codeSubmit = $("code-submit");
const resendBtn = $("resend");
const devCode = $("dev-code");

let currentEmail = "";
let resendTimer = 0;

function busy(button, on, label) {
  button.disabled = on;
  if (on) {
    button.dataset.label = button.textContent;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
}

function setError(input, el, message) {
  el.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function checkEmail(raw) {
  const email = raw.trim().toLowerCase();
  if (!email) return { error: "Enter your work email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That doesn’t look like an email address." };
  if (email.slice(email.lastIndexOf("@") + 1) !== DOMAIN) {
    return { error: `Use your @${DOMAIN} email address.` };
  }
  return { email };
}

function startResendCountdown(seconds = RESEND_SECONDS) {
  clearInterval(resendTimer);
  let left = seconds;
  const tick = () => {
    if (left <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Send a new code";
      return;
    }
    resendBtn.disabled = true;
    resendBtn.textContent = `Send a new code in ${left}s`;
    left -= 1;
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

function showStep(step) {
  stepEmail.hidden = step !== "email";
  stepCode.hidden = step !== "code";
  (step === "email" ? emailInput : codeInput).focus();
}

async function sendCode(email) {
  const data = await requestCode(email);
  currentEmail = email;
  $("code-email").textContent = email;
  devCode.hidden = !data.devCode;
  if (data.devCode) devCode.textContent = `Local development: your code is ${data.devCode}`;
  codeInput.value = "";
  setError(codeInput, codeError, "");
  showStep("code");
  startResendCountdown();
}

$("email-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, error } = checkEmail(emailInput.value);
  setError(emailInput, emailError, error);
  if (error) {
    emailInput.focus();
    return;
  }
  busy(emailSubmit, true, "Sending code…");
  try {
    await sendCode(email);
  } catch (err) {
    setError(emailInput, emailError, err.message);
    if (err.data?.retryAfter && currentEmail === email) {
      showStep("code");
      startResendCountdown(err.data.retryAfter);
    }
  } finally {
    busy(emailSubmit, false);
  }
});

emailInput.addEventListener("input", () => {
  if (emailError.textContent) setError(emailInput, emailError, "");
});

async function submitCode() {
  const code = codeInput.value.replace(/\D/g, "");
  if (code.length !== 6) {
    setError(codeInput, codeError, "Enter all 6 digits.");
    codeInput.focus();
    return;
  }
  busy(codeSubmit, true, "Signing in…");
  try {
    const data = await verifyCode(currentEmail, code);
    const next = nextPath();
    window.location.replace(data.needsProfile ? `/welcome/?next=${encodeURIComponent(next)}` : next);
  } catch (err) {
    busy(codeSubmit, false);
    setError(codeInput, codeError, err.message);
    codeInput.select();
  }
}

$("code-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submitCode();
});

codeInput.addEventListener("input", () => {
  const digits = codeInput.value.replace(/\D/g, "").slice(0, 6);
  codeInput.value = digits;
  if (codeError.textContent) setError(codeInput, codeError, "");
  if (digits.length === 6 && !codeSubmit.disabled) submitCode();
});

$("change-email").addEventListener("click", () => {
  clearInterval(resendTimer);
  showStep("email");
  emailInput.select();
});

resendBtn.addEventListener("click", async () => {
  resendBtn.disabled = true;
  try {
    await sendCode(currentEmail);
    setError(codeInput, codeError, "");
    codeError.textContent = "";
  } catch (err) {
    setError(codeInput, codeError, err.message);
    startResendCountdown(err.data?.retryAfter ?? 10);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("email")) emailInput.value = params.get("email");
emailInput.focus();

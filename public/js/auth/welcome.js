import { DEPARTMENTS, applyStoredTheme, getMe, initials, nextPath, updateMe } from "../session.js";

applyStoredTheme();

const $ = (id) => document.getElementById(id);
const form = $("profile-form");
const nameInput = $("full_name");
const deptSelect = $("department");
const titleInput = $("job_title");
const submit = $("profile-submit");

for (const d of DEPARTMENTS) deptSelect.add(new Option(d, d));

function nameFromEmail(email) {
  // maria.tovar@corehome.com → "Maria Tovar" as a starting suggestion.
  const local = (email || "").split("@")[0];
  if (!/[._-]/.test(local)) return "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

function preview() {
  const name = nameInput.value.trim();
  $("avatar").textContent = initials({ full_name: name, email: $("avatar-email").textContent });
  $("avatar-name").textContent = name || "Your name";
}

nameInput.addEventListener("input", () => {
  preview();
  $("name-error").textContent = "";
  nameInput.removeAttribute("aria-invalid");
});
deptSelect.addEventListener("change", () => ($("dept-error").textContent = ""));

const me = await getMe();
if (!me) {
  window.location.replace("/login/");
} else {
  $("avatar-email").textContent = me.email;
  nameInput.value = me.full_name || nameFromEmail(me.email);
  if (me.department) deptSelect.value = me.department;
  titleInput.value = me.job_title || "";
  preview();
  nameInput.focus();
  nameInput.select();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let ok = true;
  if (!nameInput.value.trim()) {
    $("name-error").textContent = "Enter your name.";
    nameInput.setAttribute("aria-invalid", "true");
    ok = false;
  }
  if (!deptSelect.value) {
    $("dept-error").textContent = "Choose your team.";
    ok = false;
  }
  if (!ok) return;
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    await updateMe({ full_name: nameInput.value, department: deptSelect.value, job_title: titleInput.value });
    window.location.replace(nextPath());
  } catch (err) {
    $("form-error").textContent = err.message;
    submit.disabled = false;
    submit.textContent = "Continue";
  }
});

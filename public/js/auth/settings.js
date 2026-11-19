import { iconSvg } from "../icons.js";
import { setLuminaTheme } from "../components/core-home-navbar.js";
import { DEPARTMENTS, getMe, initials, signOut, updateMe } from "../session.js";

const $ = (id) => document.getElementById(id);
const nameInput = $("full_name");
const deptSelect = $("department");
const titleInput = $("job_title");
const status = $("profile-status");
const save = $("profile-save");

for (const d of DEPARTMENTS) deptSelect.add(new Option(d, d));
$("tour-icon").innerHTML = iconSvg("auto_awesome");

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function render(me) {
  nameInput.value = me.full_name || "";
  deptSelect.value = me.department || "";
  titleInput.value = me.job_title || "";
  $("email").value = me.email;
  $("avatar").textContent = initials(me);
  $("avatar-name").textContent = me.full_name || me.email;
  $("avatar-meta").textContent = [me.job_title, me.department].filter(Boolean).join(" · ") || me.email;
  $("tour-status").textContent = me.onboarding_completed_at
    ? `Completed ${fmtDate(me.onboarding_completed_at)}. About one minute.`
    : "Not finished yet. About one minute.";
  const since = fmtDate(me.created_at);
  $("account-meta").textContent = `Signed in as ${me.email}${since ? `. Member since ${since}` : ""}.`;
}

const me = await getMe();
if (me) render(me);

for (const input of [nameInput, titleInput, deptSelect]) {
  input.addEventListener("input", () => {
    status.textContent = "";
    status.classList.remove("is-ok");
  });
}

$("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!nameInput.value.trim()) {
    $("name-error").textContent = "Enter your name.";
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    return;
  }
  $("name-error").textContent = "";
  nameInput.removeAttribute("aria-invalid");
  save.disabled = true;
  status.textContent = "Saving…";
  status.classList.remove("is-ok");
  try {
    const updated = await updateMe({
      full_name: nameInput.value,
      department: deptSelect.value || null,
      job_title: titleInput.value,
    });
    render(updated);
    document.dispatchEvent(new CustomEvent("core-home-profile-change", { detail: updated }));
    status.textContent = "Saved";
    status.classList.add("is-ok");
  } catch (err) {
    status.textContent = err.message;
  } finally {
    save.disabled = false;
  }
});

const themeButtons = document.querySelectorAll("[data-theme]");
function syncTheme() {
  const mode = document.documentElement.dataset.luminaTheme;
  themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === mode)));
}
themeButtons.forEach((b) => b.addEventListener("click", () => setLuminaTheme(b.dataset.theme)));
document.addEventListener("lumina-theme-change", syncTheme);
syncTheme();

$("sign-out").addEventListener("click", () => signOut());
$("sign-out-all").addEventListener("click", () => {
  if (window.confirm("Sign out of the Finish Library on every device, including this one?")) signOut({ everywhere: true });
});

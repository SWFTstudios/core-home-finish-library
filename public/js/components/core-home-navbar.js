/**
 * CoreHomeNavbar — shared top navigation for all Render Portal pages.
 * Mount once via <div id="core-home-navbar-mount" data-active="library" data-variant="hud">
 */
import { iconSvg } from "../icons.js";
import { firstName, getMe, initials, signOut } from "../session.js";
export const COMPONENT_NAME = "CoreHomeNavbar";
export const STORAGE_THEME = "luminaTheme";
export const NAVBAR_HEIGHT_VAR = "--core-home-navbar-height";

const NAV_ITEMS = [
  { id: "library", label: "Library", href: "/configurator/" },
  { id: "projects", label: "Projects", href: "/dashboard.html" },
  { id: "standards", label: "Standards", href: "/library.html" },
];

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_THEME);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setLuminaTheme(mode) {
  if (mode !== "light" && mode !== "dark") return;
  document.documentElement.dataset.luminaTheme = mode;
  localStorage.setItem(STORAGE_THEME, mode);
  document.getElementById("core-home-theme-light")?.setAttribute("aria-pressed", mode === "light");
  document.getElementById("core-home-theme-dark")?.setAttribute("aria-pressed", mode === "dark");
  document.dispatchEvent(new CustomEvent("lumina-theme-change", { detail: { mode } }));
}

function bindThemeToggle() {
  document.getElementById("core-home-theme-light")?.addEventListener("click", () => setLuminaTheme("light"));
  document.getElementById("core-home-theme-dark")?.addEventListener("click", () => setLuminaTheme("dark"));
  setLuminaTheme(getStoredTheme());
}

function navLinkClass(id, active) {
  return `core-home-navbar__link${id === active ? " is-active" : ""}`;
}

/**
 * @param {{ active?: string, variant?: 'default' | 'hud' }} options
 */
export function renderCoreHomeNavbarHTML(options = {}) {
  const active = options.active ?? "library";
  const variant = options.variant ?? "default";
  const variantClass = variant === "hud" ? " core-home-navbar--hud" : "";

  const links = NAV_ITEMS.map(
    (item) =>
      `<a class="${navLinkClass(item.id, active)}" href="${item.href}">${item.label}</a>`,
  ).join("");

  return `
<header class="core-home-navbar${variantClass}" data-component="${COMPONENT_NAME}">
  <div class="core-home-navbar__inner">
    <div class="core-home-navbar__brand">
      <a class="core-home-navbar__brand-link" href="/configurator/">Core Home</a>
    </div>
    <nav class="core-home-navbar__nav" aria-label="Main">
      ${links}
    </nav>
    <div class="core-home-navbar__actions">
      <div class="core-home-navbar__theme-toggle" role="group" aria-label="Color theme">
        <button type="button" id="core-home-theme-light" aria-pressed="true" title="Light mode">
          ${iconSvg("light_mode")}
        </button>
        <button type="button" id="core-home-theme-dark" aria-pressed="false" title="Dark mode">
          ${iconSvg("dark_mode")}
        </button>
      </div>
      <a class="core-home-navbar__icon-btn" href="/configurator/" aria-label="Finish Library home" title="Finish Library">
        ${iconSvg("home")}
      </a>
      <a class="core-home-navbar__icon-btn" href="/dashboard.html" aria-label="Projects" title="Projects">
        ${iconSvg("folder")}
      </a>
      <div class="core-home-account" data-account-menu>
        <button
          type="button"
          class="core-home-navbar__icon-btn core-home-account__trigger"
          id="core-home-account-btn"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-controls="core-home-account-menu"
        >
          <span class="core-home-account__avatar" data-account-avatar hidden></span>
          <span data-account-icon>${iconSvg("account_circle")}</span>
        </button>
        <div class="core-home-account__menu" id="core-home-account-menu" role="menu" aria-labelledby="core-home-account-btn" hidden>
          <div class="core-home-account__who">
            <span class="core-home-account__avatar core-home-account__avatar--lg" data-account-avatar-lg></span>
            <div>
              <b data-account-name>Signed in</b>
              <span data-account-email></span>
            </div>
          </div>
          <a role="menuitem" class="core-home-account__item" href="/settings/">${iconSvg("account_circle")}Profile and settings</a>
          <a role="menuitem" class="core-home-account__item" href="/configurator/?tour=1" data-account-tour>${iconSvg("auto_awesome")}Take the walkthrough</a>
          <hr class="core-home-account__sep" />
          <button role="menuitem" type="button" class="core-home-account__item" data-account-signout>${iconSvg("close")}Sign out</button>
        </div>
      </div>
    </div>
  </div>
</header>`.trim();
}

/**
 * Mount CoreHomeNavbar into #core-home-navbar-mount (or custom id).
 * Reads data-active and data-variant from the mount element.
 */
export function mountCoreHomeNavbar(mountId = "core-home-navbar-mount") {
  const mount = document.getElementById(mountId);
  if (!mount) return null;

  const active = mount.dataset.active ?? "library";
  const variant = mount.dataset.variant === "hud" ? "hud" : "default";
  const html = renderCoreHomeNavbarHTML({ active, variant });

  const template = document.createElement("template");
  template.innerHTML = html;
  const header = template.content.firstElementChild;
  mount.replaceWith(header);

  bindThemeToggle();
  bindAccountMenu(header);
  return header;
}

function fillAccount(header, me) {
  if (!me) return;
  const avatar = header.querySelector("[data-account-avatar]");
  avatar.textContent = initials(me);
  avatar.hidden = false;
  header.querySelector("[data-account-icon]").hidden = true;
  header.querySelector("[data-account-avatar-lg]").textContent = initials(me);
  header.querySelector("[data-account-name]").textContent = me.full_name || "Your profile";
  header.querySelector("[data-account-email]").textContent = me.email;
  header.querySelector(".core-home-account__trigger").setAttribute(
    "aria-label",
    `Account menu for ${firstName(me) || me.email}`,
  );
}

/** Avatar button → menu with settings, the walkthrough and sign-out. */
function bindAccountMenu(header) {
  const root = header.querySelector("[data-account-menu]");
  if (!root) return;
  const trigger = root.querySelector(".core-home-account__trigger");
  const menu = root.querySelector('[role="menu"]');
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];

  const open = (focusFirst = false) => {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    if (focusFirst) items()[0]?.focus();
  };
  const close = (refocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (refocus) trigger.focus();
  };

  trigger.addEventListener("click", () => (menu.hidden ? open() : close()));
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(true);
    }
  });
  menu.addEventListener("keydown", (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length].focus();
    } else if (e.key === "Tab") {
      close();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!root.contains(e.target)) close();
  });
  menu.querySelector("[data-account-signout]").addEventListener("click", () => signOut());
  // On the library itself, start the tour in place instead of reloading.
  menu.querySelector("[data-account-tour]").addEventListener("click", (e) => {
    if (window.location.pathname.startsWith("/configurator") && window.coreHomeStartTour) {
      e.preventDefault();
      close();
      window.coreHomeStartTour();
    }
  });

  getMe()
    .then((me) => fillAccount(header, me))
    .catch(() => {});
  document.addEventListener("core-home-profile-change", (e) => fillAccount(header, e.detail));
}

/** Auto-detect active route from pathname when data-active is omitted. */
export function detectActiveNav() {
  const path = window.location.pathname;
  if (path.includes("dashboard")) return "projects";
  if (path.includes("library")) return "standards";
  if (path.includes("request")) return "projects";
  return "library";
}

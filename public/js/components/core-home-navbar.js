/**
 * CoreHomeNavbar — shared top navigation for all Render Portal pages.
 * Mount once via <div id="core-home-navbar-mount" data-active="library" data-variant="hud">
 */
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
          <span class="material-symbols-outlined" aria-hidden="true">light_mode</span>
        </button>
        <button type="button" id="core-home-theme-dark" aria-pressed="false" title="Dark mode">
          <span class="material-symbols-outlined" aria-hidden="true">dark_mode</span>
        </button>
      </div>
      <button type="button" class="core-home-navbar__icon-btn" aria-label="Home">
        <span class="material-symbols-outlined">home</span>
      </button>
      <button type="button" class="core-home-navbar__icon-btn" aria-label="Folders">
        <span class="material-symbols-outlined">folder</span>
      </button>
      <button type="button" class="core-home-navbar__icon-btn" aria-label="Account">
        <span class="material-symbols-outlined">account_circle</span>
      </button>
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
  return header;
}

/** Auto-detect active route from pathname when data-active is omitted. */
export function detectActiveNav() {
  const path = window.location.pathname;
  if (path.includes("dashboard")) return "projects";
  if (path.includes("library")) return "standards";
  if (path.includes("request")) return "projects";
  return "library";
}

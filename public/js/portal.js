import { detectActiveNav, mountCoreHomeNavbar } from "./components/core-home-navbar.js";

const mount = document.getElementById("core-home-navbar-mount");
if (mount && !mount.dataset.active) {
  mount.dataset.active = detectActiveNav();
}
mountCoreHomeNavbar();

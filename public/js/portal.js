import { detectActiveNav, mountCoreHomeNavbar } from "./components/core-home-navbar.js";
import { firstName, getMe, setOnboardingComplete } from "./session.js";

const mount = document.getElementById("core-home-navbar-mount");
if (mount && !mount.dataset.active) {
  mount.dataset.active = detectActiveNav();
}
mountCoreHomeNavbar();

/** Resolve once `selector` matches something, or after `timeout` ms either way. */
function whenPresent(selector, timeout = 10000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) return resolve(true);
    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        obs.disconnect();
        resolve(true);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      resolve(false);
    }, timeout);
  });
}

function loadTourStyles() {
  if (document.querySelector('link[href="/css/onboarding-tour.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/onboarding-tour.css";
  document.head.append(link);
}

/** The Finish Library walkthrough: automatic on first visit, on demand from the account menu. */
async function setUpWalkthrough() {
  if (!window.location.pathname.startsWith("/configurator")) return;
  loadTourStyles();
  const [{ startTour, finishLibrarySteps }, me] = await Promise.all([import("./onboarding-tour.js"), getMe()]);
  if (!me) return;

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    // Let the wheel and the material tabs render first so the spotlight has something to show.
    await whenPresent("#wheel-list li");
    await new Promise((r) => setTimeout(r, 400));
    startTour(finishLibrarySteps(firstName(me)), {
      onClose: () => {
        running = false;
        if (!me.onboarding_completed_at) {
          me.onboarding_completed_at = new Date().toISOString();
          // Closing early counts as seen; Settings has the walkthrough to replay.
          setOnboardingComplete(true).catch(() => {});
        }
      },
    });
  };
  window.coreHomeStartTour = run;

  const params = new URLSearchParams(window.location.search);
  const asked = params.has("tour");
  if (asked) {
    params.delete("tour");
    const qs = params.toString();
    history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }
  if (asked || !me.onboarding_completed_at) run();
}

setUpWalkthrough().catch((err) => console.warn("Walkthrough unavailable:", err));

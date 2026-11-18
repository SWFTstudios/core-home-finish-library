/**
 * Shared finish render data (sampled colours + hand overrides).
 * No Three.js dependency — safe for the 2D preview and the 3D stage.
 */
let renderDataPromise = null;

/** Sampled colours + hand overrides; both optional. */
export function loadRenderData() {
  renderDataPromise ??= Promise.all(
    ["/data/finish-render.json", "/data/finish-render-overrides.json"].map((url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  ).then(([renderData, overrides]) => ({ renderData, overrides }));
  return renderDataPromise;
}

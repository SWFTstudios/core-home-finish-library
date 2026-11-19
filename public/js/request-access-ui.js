// Department access editor shared by Settings (your defaults) and the request form (this request).

const LEVELS = [
  ["", "No access"],
  ["view", "Can view"],
  ["comment", "Can view and comment"],
  ["edit", "Can view, comment and edit"],
];

/** Fill `container` with one row per department; `access` is { department: level }. */
export function renderAccessEditor(container, departments, access = {}) {
  container.textContent = "";
  container.classList.add("access-editor");
  for (const department of departments) {
    const row = document.createElement("div");
    row.className = "access-editor__row";

    const label = document.createElement("label");
    const id = `access-${department.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    label.htmlFor = id;
    label.textContent = department;

    const select = document.createElement("select");
    select.id = id;
    select.dataset.department = department;
    for (const [value, text] of LEVELS) select.add(new Option(text, value));
    select.value = access[department] ?? "";

    row.append(label, select);
    container.append(row);
  }
}

/** Read the editor back into { department: level }, leaving out "No access". */
export function readAccessEditor(container) {
  const access = {};
  for (const select of container.querySelectorAll("select[data-department]")) {
    if (select.value) access[select.dataset.department] = select.value;
  }
  return access;
}

export async function loadAccessDefaults() {
  const res = await fetch("/api/me/request-access", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data; // { access, saved, departments }
}

export async function saveAccessDefaults(access) {
  const res = await fetch("/api/me/request-access", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ access }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

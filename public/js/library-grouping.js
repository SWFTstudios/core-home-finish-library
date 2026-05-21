/**
 * Taxonomy helpers for Standards library — Material → Process → Style family.
 */

export const STYLE_FAMILIES = [
  {
    id: "two-tone",
    label: "Two-tone",
    description: "Two colors on one product",
    icon: "layers",
    match: (name) => /2-tone|2-color/i.test(name),
  },
  {
    id: "3d-print",
    label: "3D print",
    description: "Printed ink on the surface",
    icon: "view_in_ar",
    match: (name) => /3d print/i.test(name),
  },
  {
    id: "glitter-sparkle",
    label: "Glitter & sparkle",
    description: "Shiny flakes or color-shift effects",
    icon: "auto_awesome",
    match: (name) => /glitter|iridescent|chameleon|speckle/i.test(name),
  },
  {
    id: "uv",
    label: "UV colors",
    description: "Glows under UV light",
    icon: "wb_twilight",
    match: (name) => /\buv\b/i.test(name),
  },
  {
    id: "metallic",
    label: "Metallic",
    description: "Metal-looking shine",
    icon: "tonality",
    match: (name) => /metallic|electroplating|powder-metallic/i.test(name),
  },
  {
    id: "ombre",
    label: "Ombré",
    description: "Smooth color fade",
    icon: "gradient",
    match: (name) => /ombr/i.test(name),
  },
  {
    id: "transfer",
    label: "Transfers",
    description: "Applied decals or transfers",
    icon: "swap_horiz",
    match: (name) => /air transfer|heat transfer/i.test(name),
  },
  {
    id: "other",
    label: "More finishes",
    description: "Other looks in this group",
    icon: "palette",
    match: () => true,
  },
];

const PROCESS_META = {
  Paint: { label: "Painted", icon: "format_paint", order: 1 },
  Powder: { label: "Powder coated", icon: "texture", order: 2 },
  "Paint & Powder": { label: "Paint & powder", icon: "layers", order: 3 },
  Electroplating: { label: "Metal coating", icon: "hardware", order: 4 },
  Buff: { label: "Polished buff", icon: "auto_fix_high", order: 5 },
  UV: { label: "UV finishes", icon: "wb_twilight", order: 6 },
  "Not Applicable": { label: "Other techniques", icon: "help_outline", order: 7 },
};

export function processSlug(processName) {
  return String(processName || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function processMeta(processName) {
  const key = processName || "Other";
  return (
    PROCESS_META[key] ?? {
      label: key,
      icon: "category",
      order: 99,
    }
  );
}

export function inferStyleFamily(name) {
  for (const family of STYLE_FAMILIES) {
    if (family.id !== "other" && family.match(name)) return family.id;
  }
  return "other";
}

export function styleFamilyById(id) {
  return STYLE_FAMILIES.find((f) => f.id === id) ?? STYLE_FAMILIES[STYLE_FAMILIES.length - 1];
}

function sortFinishes(finishes) {
  return [...finishes].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Group finishes into processes, each with style-family subgroups. */
export function groupFinishesByProcessAndFamily(finishes) {
  const byProcess = new Map();

  for (const finish of finishes) {
    const processName = finish.finishProcess || finish.category || "Other";
    if (!byProcess.has(processName)) {
      byProcess.set(processName, []);
    }
    byProcess.get(processName).push(finish);
  }

  const processes = [...byProcess.entries()].map(([processName, items]) => {
    const familyMap = new Map();
    for (const finish of items) {
      const familyId = inferStyleFamily(finish.name);
      if (!familyMap.has(familyId)) familyMap.set(familyId, []);
      familyMap.get(familyId).push(finish);
    }

    const families = STYLE_FAMILIES.map((def) => {
      const list = familyMap.get(def.id) ?? [];
      if (!list.length) return null;
      return {
        ...def,
        finishes: sortFinishes(list),
        count: list.length,
      };
    }).filter(Boolean);

    const meta = processMeta(processName);
    return {
      id: processSlug(processName),
      processName,
      label: meta.label,
      icon: meta.icon,
      order: meta.order,
      count: items.length,
      families,
    };
  });

  processes.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  return processes;
}

export function buildLibraryTree(materials, finishes) {
  const grouped = groupFinishesByProcessAndFamily(finishes);
  return materials.map((material) => ({
    ...material,
    processes: material.enabled ? grouped : [],
    finishCount: material.enabled ? finishes.length : 0,
  }));
}

export function filterFinishes(finishes, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return finishes;
  return finishes.filter((f) => {
    const hay = [f.name, f.description, f.durabilityNotes, f.finishProcess, f.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export const MATERIAL_ICONS = {
  ceramic: "breakfast_dining",
  glass: "window",
  stainless_steel: "rebase",
  plastic: "shopping_bag",
};

/**
 * Who may view, comment on or edit a render request. No I/O, so it is unit tested in Node and
 * reused by the Worker. A request's preparer (requested_by) decides, per department, how much
 * access each department has; they save a default for new requests on their profile.
 */

export const ACCESS_LEVELS = ["view", "comment", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
/** department -> level; a department that is absent has no access. */
export type AccessMap = Record<string, AccessLevel>;

const RANK: Record<AccessLevel, number> = { view: 1, comment: 2, edit: 3 };

/**
 * Used for a preparer who has never saved defaults, so the teams that produce renders can still
 * pick a request up. Saving any defaults (even an empty set) replaces these.
 */
export const BUILT_IN_ACCESS: AccessMap = {
  "Industrial Design": "edit",
  Visualization: "edit",
};

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}

/** True when `have` is at least `need`. */
export function atLeast(have: AccessLevel | null, need: AccessLevel): boolean {
  return have !== null && RANK[have] >= RANK[need];
}

/**
 * Validate a client-sent department -> level map. Unknown departments and levels are errors
 * (not silently dropped); "none"/empty entries mean "no access" and are omitted.
 */
export function cleanAccessMap(
  input: unknown,
  departments: readonly string[],
): { value: AccessMap; errors: string[] } {
  const value: AccessMap = {};
  const errors: string[] = [];
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { value, errors: ["access must be an object of department to level"] };
  }
  for (const [department, level] of Object.entries(input as Record<string, unknown>)) {
    if (!departments.includes(department)) {
      errors.push(`Unknown department: ${department}`);
    } else if (level === "none" || level === "" || level === null) {
      continue;
    } else if (!isAccessLevel(level)) {
      errors.push(`Unknown access level for ${department}: ${String(level)}`);
    } else {
      value[department] = level;
    }
  }
  return { value, errors };
}

export interface Viewer {
  id: string;
  team: string | null;
  department: string | null;
}

/**
 * The viewer's level on a request: the preparer and Admins have full access, everyone else gets
 * their department's level, or null (no access) when it is not listed.
 */
export function resolveAccess(
  viewer: Viewer,
  requestedBy: string | null,
  access: AccessMap,
): AccessLevel | null {
  if (viewer.team === "Admin" || (requestedBy !== null && requestedBy === viewer.id)) return "edit";
  if (!viewer.department) return null;
  return Object.hasOwn(access, viewer.department) ? access[viewer.department] : null;
}

/** Only the preparer and Admins may change who has access. */
export function canManageAccess(viewer: Viewer, requestedBy: string | null): boolean {
  return viewer.team === "Admin" || (requestedBy !== null && requestedBy === viewer.id);
}

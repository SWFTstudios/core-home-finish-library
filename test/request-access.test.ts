import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_ACCESS,
  atLeast,
  canManageAccess,
  cleanAccessMap,
  resolveAccess,
} from "../src/request-access.ts";

const DEPTS = ["Product Development", "Industrial Design", "Graphic Design", "Sales"];
const owner = { id: "p1", team: "PD", department: "Product Development" };
const graphics = { id: "p2", team: "GD", department: "Graphic Design" };
const sales = { id: "p3", team: null, department: "Sales" };
const admin = { id: "p4", team: "Admin", department: null };
const noDept = { id: "p5", team: null, department: null };
const access = { "Graphic Design": "view", "Industrial Design": "edit" } as const;

test("graphics can view but not edit; unlisted departments see nothing", () => {
  assert.equal(resolveAccess(graphics, "p1", access), "view");
  assert.equal(atLeast("view", "edit"), false);
  assert.equal(atLeast("view", "view"), true);
  assert.equal(resolveAccess(sales, "p1", access), null);
  assert.equal(resolveAccess(noDept, "p1", access), null);
});

test("preparer and Admin always have full access", () => {
  assert.equal(resolveAccess(owner, "p1", {}), "edit");
  assert.equal(resolveAccess(admin, "p1", {}), "edit");
});

test("a request with no preparer is not owned by anyone", () => {
  assert.equal(resolveAccess(owner, null, {}), null);
});

test("department names like __proto__ never resolve to inherited properties", () => {
  assert.equal(resolveAccess({ id: "x", team: null, department: "toString" }, "p1", access), null);
});

test("only the preparer and Admin manage access", () => {
  assert.equal(canManageAccess(owner, "p1"), true);
  assert.equal(canManageAccess(admin, "p1"), true);
  assert.equal(canManageAccess(graphics, "p1"), false);
  assert.equal(canManageAccess(graphics, null), false);
});

test("cleanAccessMap keeps valid entries and treats none as no access", () => {
  const { value, errors } = cleanAccessMap(
    { "Graphic Design": "view", Sales: "none", "Industrial Design": "edit" },
    DEPTS,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(value, { "Graphic Design": "view", "Industrial Design": "edit" });
});

test("cleanAccessMap rejects unknown departments, levels and non-objects", () => {
  assert.equal(cleanAccessMap({ Nope: "view" }, DEPTS).errors.length, 1);
  assert.equal(cleanAccessMap({ Sales: "admin" }, DEPTS).errors.length, 1);
  assert.equal(cleanAccessMap(["view"], DEPTS).errors.length, 1);
  assert.equal(cleanAccessMap(null, DEPTS).errors.length, 1);
});

test("built-in access lets the render teams pick requests up", () => {
  assert.equal(BUILT_IN_ACCESS["Industrial Design"], "edit");
  assert.equal(BUILT_IN_ACCESS.Visualization, "edit");
});

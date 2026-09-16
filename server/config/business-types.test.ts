import assert from "node:assert/strict";
import test from "node:test";
import { filterModulesForBusinessType, getRequiredBusinessModule, resolveBusinessType, BUSINESS_TYPES } from "./business-types";

test("keeps legacy business types without forcing removed modules", () => {
  assert.deepEqual(BUSINESS_TYPES, ["education", "labor", "service", "recruitment", "general"]);
  assert.equal(resolveBusinessType("general"), "general");
  assert.equal(resolveBusinessType("unknown"), "general");
  assert.equal(getRequiredBusinessModule("education"), null);
});

test("sanitizes all enabled modules uniformly", () => {
  assert.deepEqual(filterModulesForBusinessType(["legacy-a", "legacy-b", "hr", "chat"], "education"), ["hr", "chat"]);
  assert.deepEqual(filterModulesForBusinessType(["legacy-a", "legacy-b", "hr", "chat"], "labor"), ["hr", "chat"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { settingValue } from "../lib/settings.ts";

test("database JSON settings decode consistently", () => {
  assert.deepEqual(settingValue('{"bank":"Test"}'), { bank: "Test" });
  assert.deepEqual(settingValue({ bank: "Test" }), { bank: "Test" });
  assert.equal(settingValue("broken"), undefined);
});

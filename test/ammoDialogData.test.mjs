import { test } from "node:test";
import assert from "node:assert/strict";

// ammoDialogData is a pure module function; util.js touches Foundry globals only
// inside instance/static methods (never at module scope), and its only import
// (weapon-qualities.js) is itself import-clean, so this loads under node:test
// with no stubs.
const { ammoDialogData } = await import("../script/common/util.js");

test("ammoDialogData: no linked ammo -> empty list, no selector, no single", () => {
    assert.deepEqual(ammoDialogData([]), {
        ammos: [],
        hasMultipleAmmo: false,
        singleAmmo: null
    });
});

test("ammoDialogData: exactly one linked ammo -> name span, no selector", () => {
    const result = ammoDialogData([{ id: "a1", name: "Bolt" }]);
    assert.equal(result.hasMultipleAmmo, false);
    assert.deepEqual(result.singleAmmo, { id: "a1", name: "Bolt" });
    assert.deepEqual(result.ammos, [{ id: "a1", name: "Bolt" }]);
});

test("ammoDialogData: more than one linked ammo -> selector, no single", () => {
    const result = ammoDialogData([
        { id: "a1", name: "Bolt" },
        { id: "a2", name: "Inferno" }
    ]);
    assert.equal(result.hasMultipleAmmo, true);
    assert.equal(result.singleAmmo, null);
    assert.deepEqual(result.ammos, [
        { id: "a1", name: "Bolt" },
        { id: "a2", name: "Inferno" }
    ]);
});

test("ammoDialogData: lean {id,name} only (no full Documents leak into rollData)", () => {
    // The input items may be full Documents with extra fields; the output must be
    // the lean {id,name} shape so rollData stays serializable for the reroll path.
    const result = ammoDialogData([{ id: "a1", name: "Bolt", system: { quantity: 9 }, extra: true }]);
    assert.deepEqual(result.ammos, [{ id: "a1", name: "Bolt" }]);
    assert.deepEqual(Object.keys(result.ammos[0]), ["id", "name"]);
});

test("ammoDialogData: tolerates null/undefined input", () => {
    assert.deepEqual(ammoDialogData(undefined), { ammos: [], hasMultipleAmmo: false, singleAmmo: null });
    assert.deepEqual(ammoDialogData(null), { ammos: [], hasMultipleAmmo: false, singleAmmo: null });
});

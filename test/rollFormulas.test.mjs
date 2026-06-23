import { test } from "node:test";
import assert from "node:assert/strict";

const { appendSignedModifier, buildDamageFormula } =
    await import("../script/common/roll-formulas.js");

test("appendSignedModifier normalizes signs and ignores zero/invalid values", () => {
    assert.equal(appendSignedModifier("1d10+4", -3), "1d10+4-3");
    assert.equal(appendSignedModifier("1d10+4", 3), "1d10+4+3");
    assert.equal(appendSignedModifier("1d10+4", 0), "1d10+4");
    assert.equal(appendSignedModifier("1d10+4", Number.NaN), "1d10+4");
});

test("buildDamageFormula includes the complete normal/Overheat damage stack", () => {
    assert.equal(buildDamageFormula({
        formula: "1d10+4+1d10",
        traits: { tearing: true, proven: 3 },
        damageBonus: 2,
        rangeDamageModifier: -3
    }), "2d10min3dl+4+1d10+2-3");
});

test("buildDamageFormula handles Primitive and an empty weapon formula", () => {
    assert.equal(buildDamageFormula({
        formula: "1d10+5",
        traits: { primitive: 7 }
    }), "1d10max7+5");
    assert.equal(buildDamageFormula({ formula: "" }), "0");
});

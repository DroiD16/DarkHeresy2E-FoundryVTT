import { test } from "node:test";
import assert from "node:assert/strict";

const {
    attackTypeModifier,
    clampTestModifier,
    combineTestModifiers,
    computeCombatAutomationModifier,
    effectiveAimModifier,
    normalizeTestModifier
} = await import("../script/common/combat-modifiers.js");

test("attackTypeModifier: matches every combat attack type", () => {
    const expected = {
        none: 0,
        standard: 10,
        semi_auto: 0,
        full_auto: -10,
        called_shot: -20,
        charge: 20,
        swift: 0,
        lightning: -10,
        allOut: 30,
        bolt: 0,
        barrage: 0,
        storm: 0,
        blast: 0
    };
    for (const [name, modifier] of Object.entries(expected)) {
        assert.equal(attackTypeModifier(name), modifier, name);
    }
});

test("effectiveAimModifier: applies Accurate and Inaccurate without double counting", () => {
    assert.equal(effectiveAimModifier({}, 10), 10);
    assert.equal(effectiveAimModifier({ accurate: true }, 10), 20);
    assert.equal(effectiveAimModifier({ accurate: true }, 20), 30);
    assert.equal(effectiveAimModifier({ accurate: true }, 0), 0);
    assert.equal(effectiveAimModifier({ inaccurate: true }, 20), 0);
    assert.equal(effectiveAimModifier({ accurate: true, inaccurate: true }, 20), 0);
});

test("computeCombatAutomationModifier: default ranged Standard Attack totals +20", () => {
    assert.deepEqual(computeCombatAutomationModifier({
        traits: {}, rangeBand: "short", attackTypeName: "standard"
    }), {
        aim: 0,
        range: 10,
        rangeQuality: 0,
        twinLinked: 0,
        attackType: 10,
        actor: 0,
        psy: 0,
        total: 20
    });
});

test("computeCombatAutomationModifier: combines Aim, range qualities and Twin-Linked", () => {
    const result = computeCombatAutomationModifier({
        traits: { scatter: true, twinLinked: true },
        aimModifier: 20,
        rangeBand: "pointBlankMelee",
        attackTypeName: "called_shot"
    });
    assert.deepEqual(result, {
        aim: 20,
        range: 0,
        rangeQuality: 10,
        twinLinked: 20,
        attackType: -20,
        actor: 0,
        psy: 0,
        total: 30
    });
});

test("computeCombatAutomationModifier: supports legacy numeric range data", () => {
    const result = computeCombatAutomationModifier({
        traits: { scatter: true }, rangeMod: 30, attackTypeName: "standard"
    });
    assert.equal(result.range, 30);
    assert.equal(result.rangeQuality, 10);
    assert.equal(result.total, 50);
});

test("computeCombatAutomationModifier: includes psychic modifier without changing weapon cases", () => {
    const result = computeCombatAutomationModifier({
        traits: {}, attackTypeName: "bolt", psyModifier: -20
    });
    assert.equal(result.total, -20);
});

test("computeCombatAutomationModifier: includes actor base modifier in automation", () => {
    const result = computeCombatAutomationModifier({
        traits: {}, attackTypeName: "standard", actorModifier: 15
    });
    assert.equal(result.actor, 15);
    assert.equal(result.total, 25);
});

test("clampTestModifier: caps only the combined modifier", () => {
    const manual = 20;
    const automation = 50;
    assert.equal(manual, 20);
    assert.equal(automation, 50);
    assert.equal(clampTestModifier(manual + automation), 60);
    assert.equal(clampTestModifier(-30 + -50), -60);
    assert.equal(clampTestModifier(15), 15);
});

test("combineTestModifiers: invalid manual input preserves automation", () => {
    assert.equal(normalizeTestModifier(""), 0);
    assert.equal(normalizeTestModifier("not-a-number"), 0);
    assert.equal(combineTestModifiers(Number.NaN, 20), 20);
    assert.equal(combineTestModifiers("", 20), 20);
    assert.equal(combineTestModifiers("15", 20), 35);
});

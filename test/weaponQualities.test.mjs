import { test } from "node:test";
import assert from "node:assert/strict";

// The pure weapon-qualities module touches no Foundry globals at module scope,
// so it imports cleanly under node:test.
const {
    WEAPON_QUALITIES,
    ammunitionMultiplier,
    buildTraitsFromQualities,
    computeMalfunction,
    computeSprayMalfunction,
    lancePenetration,
    maximalAmmoUsage,
    rangeBandModifier,
    rangeQualityEffects,
    resolveRangeBand
} =
    await import("../script/common/weapon-qualities.js");

// ---------------------------------------------------------------------------
// buildTraitsFromQualities
// ---------------------------------------------------------------------------

test("buildTraitsFromQualities: empty input yields the full contract with falsy defaults", () => {
    const traits = buildTraitsFromQualities([]);
    assert.deepEqual(traits, {
        accurate: false,
        rfFace: undefined,
        proven: undefined,
        primitive: undefined,
        razorSharp: false,
        spray: false,
        skipAttackRoll: false,
        tearing: false,
        storm: false,
        twinLinked: false,
        force: false,
        inaccurate: false,
        lance: false,
        maximal: false,
        melta: false,
        reliable: false,
        scatter: false,
        unreliable: false,
        overheats: false
    });
});

test("buildTraitsFromQualities: spray couples skipAttackRoll", () => {
    const traits = buildTraitsFromQualities([{ key: "spray", value: null }]);
    assert.equal(traits.spray, true);
    assert.equal(traits.skipAttackRoll, true);
});

test("buildTraitsFromQualities: parametric without value -> per-quality default", () => {
    const traits = buildTraitsFromQualities([
        { key: "vengeful", value: null },
        { key: "proven", value: null },
        { key: "primitive", value: null }
    ]);
    assert.equal(traits.rfFace, WEAPON_QUALITIES.vengeful.default);
    assert.equal(traits.proven, WEAPON_QUALITIES.proven.default);
    assert.equal(traits.primitive, WEAPON_QUALITIES.primitive.default);
    assert.equal(traits.rfFace, 9);
    assert.equal(traits.proven, 3);
    assert.equal(traits.primitive, 7);
});

test("buildTraitsFromQualities: parametric with explicit value uses that value", () => {
    const traits = buildTraitsFromQualities([{ key: "vengeful", value: 8 }]);
    assert.equal(traits.rfFace, 8);
});

test("buildTraitsFromQualities: absent parametric -> undefined (matches old parser)", () => {
    const traits = buildTraitsFromQualities([{ key: "tearing", value: null }]);
    assert.equal(traits.rfFace, undefined);
    assert.equal(traits.proven, undefined);
    assert.equal(traits.primitive, undefined);
});

test("buildTraitsFromQualities: new keys flip true when present", () => {
    for (const key of ["lance", "maximal", "melta", "reliable", "scatter", "unreliable", "overheats"]) {
        const traits = buildTraitsFromQualities([{ key, value: null }]);
        assert.equal(traits[key], true, `${key} should be true when present`);
    }
});

test("buildTraitsFromQualities: force flips its trait true (psychic curated key)", () => {
    const traits = buildTraitsFromQualities([{ key: "force", value: null }]);
    assert.equal(traits.force, true);
});

test("buildTraitsFromQualities: non-trait psychic curated keys produce no trait flags", () => {
    // Of the eight curated psychic keys, only `force` and `melta` map to a
    // non-null trait. The other six are damage/effect qualities with trait:null,
    // so they never appear in the traits object and never disturb the roll path.
    for (const key of ["blast", "concussive", "snare", "haywire", "hallucinogenic", "flame"]) {
        const traits = buildTraitsFromQualities([{ key, value: null }]);
        assert.equal(traits[key], undefined, `${key} should not appear in traits`);
        // The combat-roll contract fields stay falsy for these psychic-only keys,
        // so the psychic attack-type pipeline is unchanged.
        assert.equal(traits.spray, false, `${key} must not set spray`);
        assert.equal(traits.skipAttackRoll, false, `${key} must not set skipAttackRoll`);
    }
});

test("buildTraitsFromQualities: tolerates undefined / non-array input", () => {
    assert.doesNotThrow(() => buildTraitsFromQualities(undefined));
    assert.equal(buildTraitsFromQualities(undefined).accurate, false);
});

// ---------------------------------------------------------------------------
// Range bands and range-dependent qualities
// ---------------------------------------------------------------------------

test("rangeBandModifier: maps semantic bands to normal range modifiers", () => {
    assert.equal(rangeBandModifier("pointBlank"), 30);
    assert.equal(rangeBandModifier("pointBlankMelee"), 0);
    assert.equal(rangeBandModifier("short"), 10);
    assert.equal(rangeBandModifier("normal"), 0);
    assert.equal(rangeBandModifier("long"), -10);
    assert.equal(rangeBandModifier("extreme"), -30);
    assert.equal(rangeBandModifier("unknown"), 0);
});

test("resolveRangeBand: prefers semantic bands and supports legacy chat modifiers", () => {
    assert.equal(resolveRangeBand("pointBlankMelee", 30), "pointBlankMelee");
    assert.equal(resolveRangeBand(undefined, 30), "pointBlank");
    assert.equal(resolveRangeBand(undefined, 10), "short");
    assert.equal(resolveRangeBand(undefined, 0), "normal");
    assert.equal(resolveRangeBand(undefined, -10), "long");
    assert.equal(resolveRangeBand(undefined, -30), "extreme");
    assert.equal(resolveRangeBand(undefined, 5), undefined);
});

test("rangeQualityEffects: Melta doubles penetration at Short or closer", () => {
    for (const band of ["pointBlank", "pointBlankMelee", "short"]) {
        assert.equal(rangeQualityEffects({ melta: true }, band).penetrationMultiplier, 2);
    }
    for (const band of ["normal", "long", "extreme"]) {
        assert.equal(rangeQualityEffects({ melta: true }, band).penetrationMultiplier, 1);
    }
});

test("rangeQualityEffects: Scatter applies the correct hit and damage modifiers", () => {
    assert.deepEqual(rangeQualityEffects({ scatter: true }, "pointBlank"), {
        attackModifier: 10, damageModifier: 3, penetrationMultiplier: 1
    });
    assert.deepEqual(rangeQualityEffects({ scatter: true }, "pointBlankMelee"), {
        attackModifier: 10, damageModifier: 3, penetrationMultiplier: 1
    });
    assert.deepEqual(rangeQualityEffects({ scatter: true }, "short"), {
        attackModifier: 10, damageModifier: 0, penetrationMultiplier: 1
    });
    for (const band of ["normal", "long", "extreme"]) {
        assert.deepEqual(rangeQualityEffects({ scatter: true }, band), {
            attackModifier: 0, damageModifier: -3, penetrationMultiplier: 1
        });
    }
});

test("rangeQualityEffects: absent qualities and unknown ranges are inert", () => {
    const inert = { attackModifier: 0, damageModifier: 0, penetrationMultiplier: 1 };
    assert.deepEqual(rangeQualityEffects({}, "pointBlank"), inert);
    assert.deepEqual(rangeQualityEffects({ melta: true, scatter: true }, "unknown", 5), inert);
});

test("rangeQualityEffects: old chat cards derive quality effects from rangeMod", () => {
    assert.deepEqual(rangeQualityEffects({ melta: true, scatter: true }, undefined, 30), {
        attackModifier: 10, damageModifier: 3, penetrationMultiplier: 2
    });
});

// ---------------------------------------------------------------------------
// computeMalfunction (jam/overheat detection — pure, the testable core of Chunk C)
// ---------------------------------------------------------------------------

test("computeMalfunction: base single-shot jams on 96-100, not 95 (ranged)", () => {
    assert.equal(computeMalfunction({}, 95, "standard", true), null);
    assert.equal(computeMalfunction({}, 96, "standard", true), "jammed");
    assert.equal(computeMalfunction({}, 100, "standard", true), "jammed");
});

test("computeMalfunction: called_shot uses the single-shot 96 window", () => {
    assert.equal(computeMalfunction({}, 95, "called_shot", true), null);
    assert.equal(computeMalfunction({}, 96, "called_shot", true), "jammed");
});

test("computeMalfunction: semi_auto jams on 94-100, not 93", () => {
    assert.equal(computeMalfunction({}, 93, "semi_auto", true), null);
    assert.equal(computeMalfunction({}, 94, "semi_auto", true), "jammed");
});

test("computeMalfunction: full_auto jams on 94-100", () => {
    assert.equal(computeMalfunction({}, 93, "full_auto", true), null);
    assert.equal(computeMalfunction({}, 94, "full_auto", true), "jammed");
});

test("computeMalfunction: reliable jams only on a natural 100", () => {
    assert.equal(computeMalfunction({ reliable: true }, 99, "standard", true), null);
    assert.equal(computeMalfunction({ reliable: true }, 100, "standard", true), "jammed");
    // Even in a Semi-/Full-Auto burst, Reliable narrows the window to 100.
    assert.equal(computeMalfunction({ reliable: true }, 99, "full_auto", true), null);
});

test("computeMalfunction: unreliable jams on 91-100 in every mode", () => {
    assert.equal(computeMalfunction({ unreliable: true }, 90, "standard", true), null);
    assert.equal(computeMalfunction({ unreliable: true }, 91, "standard", true), "jammed");
    assert.equal(computeMalfunction({ unreliable: true }, 91, "semi_auto", true), "jammed");
});

test("computeMalfunction: overheats overheats on 91-100, never jams", () => {
    assert.equal(computeMalfunction({ overheats: true }, 90, "standard", true), null);
    assert.equal(computeMalfunction({ overheats: true }, 91, "standard", true), "overheated");
    assert.equal(computeMalfunction({ overheats: true }, 100, "standard", true), "overheated");
});

test("computeMalfunction: overheats takes precedence over reliable and unreliable", () => {
    // Overheats absorbs any jam-causing effect: a 91 overheats (not the
    // reliable-narrowed 100, nor a jam).
    assert.equal(computeMalfunction({ overheats: true, reliable: true }, 91, "standard", true), "overheated");
    assert.equal(computeMalfunction({ overheats: true, unreliable: true }, 91, "standard", true), "overheated");
});

test("computeMalfunction: overheats applies regardless of fire mode and even when not ranged", () => {
    // Overheats is checked before the ranged-only guard, so a melee/no-range
    // overheating weapon still overheats.
    assert.equal(computeMalfunction({ overheats: true }, 91, "standard", false), "overheated");
    assert.equal(computeMalfunction({ overheats: true }, 90, "standard", false), null);
});

test("computeMalfunction: melee (non-ranged) weapons never jam without overheats", () => {
    assert.equal(computeMalfunction({}, 100, "standard", false), null);
    assert.equal(computeMalfunction({ unreliable: true }, 100, "standard", false), null);
    assert.equal(computeMalfunction({ reliable: true }, 100, "standard", false), null);
});

test("computeMalfunction: a natural 100 always triggers for base and unreliable", () => {
    assert.equal(computeMalfunction({}, 100, "standard", true), "jammed");
    assert.equal(computeMalfunction({}, 100, "semi_auto", true), "jammed");
    assert.equal(computeMalfunction({ unreliable: true }, 100, "full_auto", true), "jammed");
});

test("computeMalfunction: tolerates missing/undefined traits object", () => {
    assert.equal(computeMalfunction(undefined, 96, "standard", true), "jammed");
    assert.equal(computeMalfunction(undefined, 95, "standard", true), null);
});

// ---------------------------------------------------------------------------
// lancePenetration — only the base scales per degree of success
// ---------------------------------------------------------------------------

test("lancePenetration: pure Lance weapon (no additive bonus) = base x (1 + DoS)", () => {
    // base 5, 3 DoS, no bonuses -> full pen is just the base 5 -> 5 + 5*3 = 20.
    assert.equal(lancePenetration(5, 5, 3), 20);
});

test("lancePenetration: additive bonuses are NOT multiplied per degree", () => {
    // base 5 + Maximal's +2 -> full pen 7; at 3 DoS only the base 5 scales:
    // 7 + 5*3 = 22 (NOT (5+2)*(1+3) = 28).
    assert.equal(lancePenetration(7, 5, 3), 22);
});

test("lancePenetration: zero / missing DoS adds nothing (Spray/skip path)", () => {
    assert.equal(lancePenetration(5, 5, 0), 5);
    assert.equal(lancePenetration(5, 5, undefined), 5);
    assert.equal(lancePenetration(5, 5, -2), 5); // clamped at 0
});

test("lancePenetration: stacks on a Razor Sharp-doubled full pen", () => {
    // Razor Sharp already doubled full pen to 10 (base 5 x2); Lance adds base 5
    // per degree on top: 10 + 5*2 = 20.
    assert.equal(lancePenetration(10, 5, 2), 20);
});

// ---------------------------------------------------------------------------
// Maximal ammunition use
// ---------------------------------------------------------------------------

test("ammunitionMultiplier: combines multipliers additively", () => {
    assert.equal(ammunitionMultiplier({}, false), 1);
    assert.equal(ammunitionMultiplier({}, true), 3);
    assert.equal(ammunitionMultiplier({ storm: true }, true), 4);
    assert.equal(ammunitionMultiplier({ twinLinked: true }, true), 4);
    assert.equal(ammunitionMultiplier({ storm: true, twinLinked: true }, true), 5);
});

test("maximalAmmoUsage: partial burst spends only complete Maximal charges", () => {
    assert.deepEqual(maximalAmmoUsage(7, 3, {}), { ammoSpent: 6, shotsFired: 2 });
    assert.deepEqual(maximalAmmoUsage(2, 3, {}), { ammoSpent: 0, shotsFired: 0 });
});

test("maximalAmmoUsage: caps a burst at its rate and leaves excess ammunition", () => {
    assert.deepEqual(maximalAmmoUsage(20, 2, {}), { ammoSpent: 6, shotsFired: 2 });
});

test("maximalAmmoUsage: Storm doubles hit capacity after combined ammo cost", () => {
    assert.deepEqual(maximalAmmoUsage(9, 3, { storm: true }), { ammoSpent: 8, shotsFired: 4 });
});

test("maximalAmmoUsage: Twin-Linked extra hit remains outside ammo-capacity calculation", () => {
    assert.deepEqual(maximalAmmoUsage(9, 3, { twinLinked: true }), { ammoSpent: 8, shotsFired: 2 });
});

// ---------------------------------------------------------------------------
// computeMalfunction — craftsmanship interaction
// ---------------------------------------------------------------------------

test("computeMalfunction: Best craftsmanship never jams or overheats", () => {
    assert.equal(computeMalfunction({}, 100, "standard", true, "best"), null);
    assert.equal(computeMalfunction({ overheats: true }, 100, "standard", true, "best"), null);
    assert.equal(computeMalfunction({ unreliable: true }, 100, "full_auto", true, "best"), null);
});

test("computeMalfunction: Poor craftsmanship grants Unreliable (jam at 91+)", () => {
    assert.equal(computeMalfunction({}, 90, "standard", true, "poor"), null);
    assert.equal(computeMalfunction({}, 91, "standard", true, "poor"), "jammed");
});

test("computeMalfunction: Poor + already Unreliable jams on any failed hit", () => {
    // isSuccess === false -> jam regardless of the result value.
    assert.equal(computeMalfunction({ unreliable: true }, 30, "standard", true, "poor", false), "jammed");
    // A successful hit does not jam under this clause.
    assert.equal(computeMalfunction({ unreliable: true }, 30, "standard", true, "poor", true), null);
});

test("computeMalfunction: Good craftsmanship grants Reliable (jam only on 100)", () => {
    assert.equal(computeMalfunction({}, 99, "standard", true, "good"), null);
    assert.equal(computeMalfunction({}, 100, "standard", true, "good"), "jammed");
});

test("computeMalfunction: Good craftsmanship removes Unreliable (back to baseline)", () => {
    // Unreliable would jam at 91; Good removes it -> baseline 96 single-shot.
    assert.equal(computeMalfunction({ unreliable: true }, 95, "standard", true, "good"), null);
    assert.equal(computeMalfunction({ unreliable: true }, 96, "standard", true, "good"), "jammed");
});

test("computeMalfunction: Common craftsmanship is baseline (96 single / 94 burst)", () => {
    assert.equal(computeMalfunction({}, 95, "standard", true, "common"), null);
    assert.equal(computeMalfunction({}, 96, "standard", true, "common"), "jammed");
    assert.equal(computeMalfunction({}, 94, "full_auto", true, "common"), "jammed");
});

test("computeMalfunction: Poor degrades a Reliable weapon to Unreliable (jam at 91+)", () => {
    // A Poor Reliable weapon (e.g. a Poor lasgun): Poor's Unreliable overrides
    // Reliable, so 91-99 jams rather than only 100.
    assert.equal(computeMalfunction({ reliable: true }, 90, "standard", true, "poor"), null);
    assert.equal(computeMalfunction({ reliable: true }, 91, "standard", true, "poor"), "jammed");
});

// ---------------------------------------------------------------------------
// computeSprayMalfunction — jam on a damage-die 9
// ---------------------------------------------------------------------------

test("computeSprayMalfunction: a natural 9 jams; no 9 does not", () => {
    assert.equal(computeSprayMalfunction({}, "common", [3, 9, 5]), "jammed");
    assert.equal(computeSprayMalfunction({}, "common", [3, 8, 10]), null);
    assert.equal(computeSprayMalfunction({}, "common", []), null);
});

test("computeSprayMalfunction: effectively-Reliable spray never jams", () => {
    assert.equal(computeSprayMalfunction({ reliable: true }, "common", [9]), null); // Reliable quality
    assert.equal(computeSprayMalfunction({}, "good", [9]), null);                   // Good grants Reliable
    assert.equal(computeSprayMalfunction({}, "best", [9]), null);                   // Best never jams
});

test("computeSprayMalfunction: Good does not exempt an Unreliable spray", () => {
    // Good only grants Reliable when the weapon is NOT Unreliable.
    assert.equal(computeSprayMalfunction({ unreliable: true }, "good", [9]), "jammed");
});

test("computeSprayMalfunction: an Overheats spray overheats instead of jamming", () => {
    assert.equal(computeSprayMalfunction({ overheats: true }, "common", [9]), "overheated");
});

// Edge combinations (quality x craftsmanship) — the trigger-then-type model.

test("computeMalfunction: Best craftsmanship immunity is ranged-only (melee Overheats still overheats)", () => {
    // Best MELEE craftsmanship grants +WS/+dmg, NOT malfunction immunity.
    assert.equal(computeMalfunction({ overheats: true }, 95, "standard", false, "best"), "overheated");
    // Best RANGED is immune.
    assert.equal(computeMalfunction({ overheats: true }, 95, "standard", true, "best"), null);
});

test("computeMalfunction: Poor + already-Unreliable keeps the 91+ jam on a high-target success", () => {
    // A success at 91+ still jams (Unreliable's own trigger), not only failed hits.
    assert.equal(computeMalfunction({ unreliable: true }, 95, "standard", true, "poor", true), "jammed");
});

test("computeMalfunction: Poor + Unreliable + Overheats converts a failed-hit jam into an overheat", () => {
    // Failed hit below 91: Poor adds the failed-hit jam, Overheats converts it.
    assert.equal(computeMalfunction({ unreliable: true, overheats: true }, 40, "standard", true, "poor", false), "overheated");
});

test("computeSprayMalfunction: Overheats converts the 9 even on a Reliable/Good spray (only Best stops it)", () => {
    assert.equal(computeSprayMalfunction({ overheats: true, reliable: true }, "common", [9]), "overheated");
    assert.equal(computeSprayMalfunction({ overheats: true }, "good", [9]), "overheated");
    assert.equal(computeSprayMalfunction({ overheats: true }, "best", [9]), null);
});

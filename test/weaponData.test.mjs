import { test } from "node:test";
import assert from "node:assert/strict";

// These modules read `foundry.data.fields` and extend
// `foundry.abstract.TypeDataModel` at import time. `defineSchema` is not invoked
// at import, so the field constructors need not be real — only the namespaces
// and a base class with a static `migrateData` must exist. Stub before importing.
globalThis.foundry = globalThis.foundry || {};
globalThis.foundry.data = globalThis.foundry.data || { fields: {} };
globalThis.foundry.abstract = globalThis.foundry.abstract || {
    TypeDataModel: class {
        static migrateData(s) {
            return s;
        }
    }
};

const { default: WeaponData } = await import("../script/data/item/weaponData.js");
const { default: AmmunitionData } = await import("../script/data/item/ammunitionData.js");
const { default: PsychicPowerData } = await import("../script/data/item/psychicPowerData.js");

test("migrateRateOfFire converts each string field independently (regression guard)", () => {
    const source = { rateOfFire: { single: "3", burst: "2", full: "1" } };
    WeaponData.migrateRateOfFire(source);
    assert.deepEqual(source.rateOfFire, { single: 3, burst: 2, full: 1 });
    // The copy-paste bug would have produced burst:3 and full:3.
    assert.notEqual(source.rateOfFire.burst, 3);
    assert.notEqual(source.rateOfFire.full, 3);
});

test("migrateRateOfFire coerces mixed/bad values via parseInt, defaulting to 0", () => {
    const source = { rateOfFire: { single: "5", burst: "nope", full: null } };
    WeaponData.migrateRateOfFire(source);
    assert.deepEqual(source.rateOfFire, { single: 5, burst: 0, full: 0 });
});

test("migrateRateOfFire leaves already-integer values unchanged (trigger guard)", () => {
    const source = { rateOfFire: { single: 4, burst: 3, full: 2 } };
    WeaponData.migrateRateOfFire(source);
    assert.deepEqual(source.rateOfFire, { single: 4, burst: 3, full: 2 });
});

test("migrateRateOfFire does not throw on missing rateOfFire", () => {
    const undefSource = {};
    assert.doesNotThrow(() => WeaponData.migrateRateOfFire(undefSource));
    assert.equal(undefSource.rateOfFire, undefined);

    const nullSource = { rateOfFire: null };
    assert.doesNotThrow(() => WeaponData.migrateRateOfFire(nullSource));
    assert.equal(nullSource.rateOfFire, null);
});

test("WeaponData.migrateData returns the same source object and applies the rof fix", () => {
    const source = { rateOfFire: { single: "3", burst: "2", full: "1" } };
    const result = WeaponData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    assert.deepEqual(result.rateOfFire, { single: 3, burst: 2, full: 1 });
});

test("WeaponData.migrateData leaves legacy Special text untouched", () => {
    const source = {
        rateOfFire: { single: 1, burst: 0, full: 0 },
        special: "Accurate, custom text",
        specialQualities: []
    };
    WeaponData.migrateData(source);
    assert.equal(source.special, "Accurate, custom text");
    assert.deepEqual(source.specialQualities, []);
});

test("WeaponData.migrateAmmunitionLink normalizes legacy arrays to one ID", () => {
    const first = { ammo: ["ammo-1", "ammo-2"] };
    WeaponData.migrateAmmunitionLink(first);
    assert.equal(first.ammo, "ammo-1");

    const empty = { ammo: [] };
    WeaponData.migrateAmmunitionLink(empty);
    assert.equal(empty.ammo, "");

    const current = { ammo: "ammo-3" };
    WeaponData.migrateAmmunitionLink(current);
    assert.equal(current.ammo, "ammo-3");
});

test("migrateSpecialQualities normalizes unsafe parametric values", () => {
    const source = {
        specialQualities: [
            { key: "vengeful", value: -5 },
            { key: "primitive", value: 6.8 },
            { key: "proven", value: "4" },
            { key: "blast", value: "invalid" },
            { key: "toxic", value: null }
        ]
    };
    WeaponData.migrateSpecialQualities(source);
    assert.deepEqual(source.specialQualities, [
        { key: "vengeful", value: 0 },
        { key: "primitive", value: 6 },
        { key: "proven", value: 4 },
        { key: "blast", value: null },
        { key: "toxic", value: null }
    ]);
});

test("AmmunitionData.migrateData returns the same source object", () => {
    const source = { effect: { damage: { modifier: "2" } } };
    const result = AmmunitionData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    // migrateDamageModifier logic is unchanged: string coerced to int.
    assert.equal(result.effect.damage.modifier, 2);
});

test("AmmunitionData.migrateData normalizes specialQualities while keeping migrateDamageModifier", () => {
    const source = {
        effect: {
            damage: { modifier: "2" },
            specialQualities: [{ key: "toxic", value: 9.9 }]
        }
    };
    const result = AmmunitionData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    assert.equal(result.effect.damage.modifier, 2);
    assert.deepEqual(result.effect.specialQualities, [{ key: "toxic", value: 9 }]);
});

// ---------------------------------------------------------------------------
// AmmunitionData.migrateSpecialQualities — same numeric normalizer as
// WeaponData, but the array is NESTED under `effect`.
// ---------------------------------------------------------------------------

test("AmmunitionData.migrateSpecialQualities normalizes unsafe nested parametric values", () => {
    const source = {
        effect: {
            special: "Tearing, custom text",
            specialQualities: [
                { key: "blast", value: -5 },
                { key: "toxic", value: 6.8 },
                { key: "hallucinogenic", value: "4" },
                { key: "shocking", value: "invalid" },
                // A non-curated key is normalized regardless of curation.
                { key: "proven", value: 3.2 },
                { key: "tearing", value: null }
            ]
        }
    };
    AmmunitionData.migrateSpecialQualities(source);
    assert.deepEqual(source.effect.specialQualities, [
        { key: "blast", value: 0 },
        { key: "toxic", value: 6 },
        { key: "hallucinogenic", value: 4 },
        { key: "shocking", value: null },
        { key: "proven", value: 3 },
        { key: "tearing", value: null }
    ]);
    // Free-text special is never parsed into structured qualities (out of scope).
    assert.equal(source.effect.special, "Tearing, custom text");
});

test("AmmunitionData.migrateSpecialQualities does not throw on missing effect", () => {
    const undefSource = {};
    assert.doesNotThrow(() => AmmunitionData.migrateSpecialQualities(undefSource));
    assert.equal(undefSource.effect, undefined);

    const noArray = { effect: { special: "Blast" } };
    assert.doesNotThrow(() => AmmunitionData.migrateSpecialQualities(noArray));
    assert.equal(noArray.effect.specialQualities, undefined);
});

// ---------------------------------------------------------------------------
// PsychicPowerData.migrateSpecialQualities — same numeric normalizer as
// WeaponData, but the array is NESTED under `damage`.
// ---------------------------------------------------------------------------

test("PsychicPowerData.migrateSpecialQualities normalizes unsafe nested parametric values", () => {
    const source = {
        damage: {
            special: "Force, custom text",
            specialQualities: [
                { key: "blast", value: -5 },
                { key: "concussive", value: 6.8 },
                { key: "snare", value: "4" },
                { key: "haywire", value: "invalid" },
                { key: "force", value: null }
            ]
        }
    };
    PsychicPowerData.migrateSpecialQualities(source);
    assert.deepEqual(source.damage.specialQualities, [
        { key: "blast", value: 0 },
        { key: "concussive", value: 6 },
        { key: "snare", value: 4 },
        { key: "haywire", value: null },
        { key: "force", value: null }
    ]);
    // Free-text special is never parsed into structured qualities (out of scope).
    assert.equal(source.damage.special, "Force, custom text");
});

test("PsychicPowerData.migrateSpecialQualities does not throw on missing damage", () => {
    const undefSource = {};
    assert.doesNotThrow(() => PsychicPowerData.migrateSpecialQualities(undefSource));
    assert.equal(undefSource.damage, undefined);

    const noArray = { damage: { special: "Blast" } };
    assert.doesNotThrow(() => PsychicPowerData.migrateSpecialQualities(noArray));
    assert.equal(noArray.damage.specialQualities, undefined);
});

test("PsychicPowerData.migrateData returns the same source object and leaves free text untouched", () => {
    const source = {
        damage: {
            special: "Hallucinogenic (2)",
            specialQualities: [{ key: "hallucinogenic", value: 9.9 }]
        }
    };
    const result = PsychicPowerData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    assert.deepEqual(result.damage.specialQualities, [{ key: "hallucinogenic", value: 9 }]);
    assert.equal(result.damage.special, "Hallucinogenic (2)");
});

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

// ---------------------------------------------------------------------------
// Retained read-time shims: rateOfFire (weapon), ammunition link (weapon),
// damage modifier (ammunition). The numeric `specialQualities` normalizers and
// the malfunction string->bool shim were removed (dev-only shapes never shipped;
// the schema's own field cleaning covers strays). Free-text -> structured is now
// the one-time world migration (see migration.test.mjs / qualityParser.test.mjs).
// ---------------------------------------------------------------------------

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

test("WeaponData.migrateData leaves free-text Special and specialQualities untouched", () => {
    const source = {
        rateOfFire: { single: 1, burst: 0, full: 0 },
        special: "Accurate, custom text",
        specialQualities: []
    };
    WeaponData.migrateData(source);
    // The free-text -> structured parse is the one-time world migration, NOT a
    // read shim, so migrateData never seeds qualities from `special`.
    assert.equal(source.special, "Accurate, custom text");
    assert.deepEqual(source.specialQualities, []);
});

test("WeaponData.migrateData no longer coerces a legacy malfunction string", () => {
    // The malfunction string->bool shim was removed; the schema's BooleanField
    // owns casting now. migrateData must leave the source field as-is.
    const source = { rateOfFire: { single: 0, burst: 0, full: 0 }, malfunction: "jammed" };
    WeaponData.migrateData(source);
    assert.equal(source.malfunction, "jammed");
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

test("AmmunitionData.migrateData coerces the damage modifier and leaves qualities untouched", () => {
    const source = {
        effect: {
            damage: { modifier: "2" },
            specialQualities: [{ key: "toxic", value: 9.9 }]
        }
    };
    const result = AmmunitionData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    assert.equal(result.effect.damage.modifier, 2);
    // The specialQualities normalizer was removed; the SchemaField NumberField
    // (min:0, integer:true) cleans stray values at construction instead.
    assert.deepEqual(result.effect.specialQualities, [{ key: "toxic", value: 9.9 }]);
});

test("PsychicPowerData no longer overrides migrateData (inherited no-op leaves data untouched)", () => {
    const source = {
        damage: {
            special: "Hallucinogenic (2)",
            specialQualities: [{ key: "hallucinogenic", value: 9.9 }]
        }
    };
    const result = PsychicPowerData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    assert.deepEqual(result.damage.specialQualities, [{ key: "hallucinogenic", value: 9.9 }]);
    assert.equal(result.damage.special, "Hallucinogenic (2)");
});

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

test("AmmunitionData.migrateData returns the same source object", () => {
    const source = { effect: { damage: { modifier: "2" } } };
    const result = AmmunitionData.migrateData(source);
    assert.equal(result, source, "returns the same (referential) source object");
    // migrateDamageModifier logic is unchanged: string coerced to int.
    assert.equal(result.effect.damage.modifier, 2);
});

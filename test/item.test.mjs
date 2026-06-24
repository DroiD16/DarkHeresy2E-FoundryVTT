import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.Item = class {};

const translations = new Map();
globalThis.game = {
    i18n: {
        localize: key => translations.get(key) ?? key
    }
};

const { DarkHeresyItem } = await import("../script/common/item.js");

function makeWeapon(rateOfFire) {
    const weapon = new DarkHeresyItem();
    weapon.system = { rateOfFire };
    return weapon;
}

test("RateOfFire localizes the single-shot abbreviation", () => {
    const weapon = makeWeapon({ single: 1, burst: 3, full: 5 });

    translations.set("WEAPON.RATE_OF_FIRE_SINGLE", "S");
    assert.equal(weapon.RateOfFire, "S/3/5");

    translations.set("WEAPON.RATE_OF_FIRE_SINGLE", "О");
    assert.equal(weapon.RateOfFire, "О/3/5");
});

test("RateOfFire keeps a dash when single-shot is unavailable", () => {
    const weapon = makeWeapon({ single: 0, burst: 3, full: 5 });
    translations.set("WEAPON.RATE_OF_FIRE_SINGLE", "О");

    assert.equal(weapon.RateOfFire, "-/3/5");
});

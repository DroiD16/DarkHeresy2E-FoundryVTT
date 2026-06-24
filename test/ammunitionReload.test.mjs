import { test } from "node:test";
import assert from "node:assert/strict";

import { reloadWeapon } from "../script/common/ammunition-reload.js";

function makeAmmo(id, quantity) {
    return { id, type: "ammunition", system: { quantity } };
}

function makeReloadFixture({ ammoItems = [] } = {}) {
    const weapon = {
        id: "weapon",
        type: "weapon",
        system: {
            ammoItems,
            clip: { value: 0, max: 12 }
        }
    };
    const items = [weapon, ...ammoItems];
    items.get = id => items.find(item => item.id === id);
    const updates = [];
    const actor = {
        items,
        async updateEmbeddedDocuments(_type, changes) {
            updates.push(...changes);
        }
    };
    weapon.actor = actor;
    for (const ammo of ammoItems) ammo.actor = actor;
    return { weapon, ammoItems, updates };
}

test("reload with one linked ammo fills clip and consumes one magazine", async () => {
    const { weapon, updates } = makeReloadFixture({ ammoItems: [makeAmmo("ammo", 3)] });
    let warned = false;
    let reminded = false;
    await reloadWeapon(weapon, {
        warn: async () => { warned = true; },
        remind: async () => { reminded = true; }
    });
    assert.deepEqual(updates, [
        { _id: "weapon", "system.clip.value": 12 },
        { _id: "ammo", "system.quantity": 2 }
    ]);
    assert.equal(warned, false);
    assert.equal(reminded, false);
});

test("reload with one depleted ammo warns without going negative", async () => {
    const ammo = makeAmmo("ammo", 0);
    const { weapon, updates } = makeReloadFixture({ ammoItems: [ammo] });
    let warningArgs;
    let reminded = false;
    await reloadWeapon(weapon, {
        warn: async (...args) => { warningArgs = args; },
        remind: async () => { reminded = true; }
    });
    assert.deepEqual(updates, [
        { _id: "weapon", "system.clip.value": 12 },
        { _id: "ammo", "system.quantity": 0 }
    ]);
    assert.deepEqual(warningArgs, [weapon, ammo]);
    assert.equal(reminded, false);
});

test("reload with NO linked ammo fills clip only", async () => {
    const { weapon, updates } = makeReloadFixture({ ammoItems: [] });
    let warned = false;
    let reminded = false;
    await reloadWeapon(weapon, {
        warn: async () => { warned = true; },
        remind: async () => { reminded = true; }
    });
    assert.deepEqual(updates, [{ _id: "weapon", "system.clip.value": 12 }]);
    assert.equal(warned, false);
    assert.equal(reminded, false);
});

test("reload with MULTIPLE linked ammo fills clip, consumes nothing, reminds", async () => {
    const ammo1 = makeAmmo("ammo1", 4);
    const ammo2 = makeAmmo("ammo2", 7);
    const { weapon, updates } = makeReloadFixture({ ammoItems: [ammo1, ammo2] });
    let warned = false;
    let reminderArgs;
    await reloadWeapon(weapon, {
        warn: async () => { warned = true; },
        remind: async (...args) => { reminderArgs = args; }
    });
    assert.deepEqual(updates, [{ _id: "weapon", "system.clip.value": 12 }]);
    assert.equal(warned, false);
    assert.deepEqual(reminderArgs, [weapon]);
    // Neither ammo quantity was changed.
    assert.equal(ammo1.system.quantity, 4);
    assert.equal(ammo2.system.quantity, 7);
});

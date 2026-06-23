import { test } from "node:test";
import assert from "node:assert/strict";

import { reloadWeapon } from "../script/common/ammunition-reload.js";

function makeReloadFixture({ quantity, linked = true }) {
    const ammunition = {
        id: "ammo",
        type: "ammunition",
        system: { quantity }
    };
    const weapon = {
        id: "weapon",
        type: "weapon",
        system: {
            ammo: linked ? ammunition.id : "",
            clip: { value: 0, max: 12 }
        }
    };
    const items = [weapon, ammunition];
    items.get = id => items.find(item => item.id === id);
    const updates = [];
    const actor = {
        items,
        async updateEmbeddedDocuments(_type, changes) {
            updates.push(...changes);
        }
    };
    weapon.actor = actor;
    ammunition.actor = actor;
    return { weapon, ammunition, updates };
}

test("reloadWeapon fills the clip and consumes one magazine", async () => {
    const { weapon, updates } = makeReloadFixture({ quantity: 3 });
    let warned = false;
    await reloadWeapon(weapon, { warn: async () => { warned = true; } });
    assert.deepEqual(updates, [
        { _id: "weapon", "system.clip.value": 12 },
        { _id: "ammo", "system.quantity": 2 }
    ]);
    assert.equal(warned, false);
});

test("reloadWeapon permits an empty stack and warns without going negative", async () => {
    const { weapon, ammunition, updates } = makeReloadFixture({ quantity: 0 });
    let warningArgs;
    await reloadWeapon(weapon, { warn: async (...args) => { warningArgs = args; } });
    assert.deepEqual(updates, [
        { _id: "weapon", "system.clip.value": 12 },
        { _id: "ammo", "system.quantity": 0 }
    ]);
    assert.deepEqual(warningArgs, [weapon, ammunition]);
});

test("reloadWeapon without linked ammunition keeps the old free reload", async () => {
    const { weapon, updates } = makeReloadFixture({ quantity: 5, linked: false });
    let warned = false;
    await reloadWeapon(weapon, { warn: async () => { warned = true; } });
    assert.deepEqual(updates, [{ _id: "weapon", "system.clip.value": 12 }]);
    assert.equal(warned, false);
});

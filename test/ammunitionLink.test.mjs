import { test } from "node:test";
import assert from "node:assert/strict";

import {
    linkAmmunition,
    unlinkAmmunition,
    unlinkWeaponAmmunitionOne
} from "../script/common/ammunition-link.js";

function makeActor(itemDefs) {
    const actor = {};
    const items = itemDefs.map(def => ({ ...def, actor, system: { ...def.system } }));
    items.get = id => items.find(item => item.id === id);
    actor.items = items;
    actor.updateEmbeddedDocuments = async (_type, updates) => {
        for (const update of updates) {
            const item = items.get(update._id);
            for (const [path, value] of Object.entries(update)) {
                if (path === "system.ammo") item.system.ammo = value;
                if (path === "system.weaponId") item.system.weaponId = value;
            }
        }
        return updates.map(update => items.get(update._id));
    };
    return actor;
}

test("linkAmmunition adds to the weapon's array (dedup)", async () => {
    const actor = makeActor([
        { id: "weapon", type: "weapon", system: { ammo: ["a1"] } },
        { id: "a1", type: "ammunition", system: { weaponId: "weapon" } },
        { id: "a2", type: "ammunition", system: { weaponId: "" } }
    ]);

    await linkAmmunition(actor.items.get("weapon"), actor.items.get("a2"));
    assert.deepEqual(actor.items.get("weapon").system.ammo, ["a1", "a2"]);
    assert.equal(actor.items.get("a2").system.weaponId, "weapon");

    // Linking an ammo already present does not create a duplicate.
    await linkAmmunition(actor.items.get("weapon"), actor.items.get("a1"));
    assert.deepEqual(actor.items.get("weapon").system.ammo, ["a1", "a2"]);
});

test("linkAmmunition detaches the ammo from its previous weapon", async () => {
    const actor = makeActor([
        { id: "weapon-1", type: "weapon", system: { ammo: ["x"] } },
        { id: "weapon-2", type: "weapon", system: { ammo: ["a"] } },
        { id: "x", type: "ammunition", system: { weaponId: "weapon-1" } },
        { id: "a", type: "ammunition", system: { weaponId: "weapon-2" } }
    ]);

    await linkAmmunition(actor.items.get("weapon-1"), actor.items.get("a"));

    assert.ok(actor.items.get("weapon-1").system.ammo.includes("a"));
    assert.ok(!actor.items.get("weapon-2").system.ammo.includes("a"));
    assert.equal(actor.items.get("a").system.weaponId, "weapon-1");
    // weapon-1's pre-existing ammo is untouched (one-ammo-per-weapon rule is gone).
    assert.ok(actor.items.get("weapon-1").system.ammo.includes("x"));
});

test("linkAmmunition does NOT clear other ammo on the same weapon", async () => {
    const actor = makeActor([
        { id: "weapon", type: "weapon", system: { ammo: ["a1"] } },
        { id: "a1", type: "ammunition", system: { weaponId: "weapon" } },
        { id: "a2", type: "ammunition", system: { weaponId: "" } }
    ]);

    await linkAmmunition(actor.items.get("weapon"), actor.items.get("a2"));
    assert.ok(actor.items.get("weapon").system.ammo.includes("a1"));
    assert.ok(actor.items.get("weapon").system.ammo.includes("a2"));
});

test("unlinkWeaponAmmunitionOne removes one and clears its reverse link", async () => {
    const actor = makeActor([
        { id: "weapon", type: "weapon", system: { ammo: ["a1", "a2"] } },
        { id: "a1", type: "ammunition", system: { weaponId: "weapon" } },
        { id: "a2", type: "ammunition", system: { weaponId: "weapon" } }
    ]);

    await unlinkWeaponAmmunitionOne(actor.items.get("weapon"), "a1");
    assert.deepEqual(actor.items.get("weapon").system.ammo, ["a2"]);
    assert.equal(actor.items.get("a1").system.weaponId, "");
    assert.equal(actor.items.get("a2").system.weaponId, "weapon");

    // Unlinking an id NOT in the array is a no-op.
    const result = await unlinkWeaponAmmunitionOne(actor.items.get("weapon"), "not-there");
    assert.deepEqual(result, []);
    assert.deepEqual(actor.items.get("weapon").system.ammo, ["a2"]);
});

test("unlinkAmmunition (ammo-side) removes its id from the weapon's array", async () => {
    const actor = makeActor([
        { id: "weapon", type: "weapon", system: { ammo: ["a1", "a2"] } },
        { id: "a1", type: "ammunition", system: { weaponId: "weapon" } },
        { id: "a2", type: "ammunition", system: { weaponId: "weapon" } }
    ]);

    await unlinkAmmunition(actor.items.get("a1"));
    assert.deepEqual(actor.items.get("weapon").system.ammo, ["a2"]);
    assert.equal(actor.items.get("a1").system.weaponId, "");
});

test("linkAmmunition rejects documents from different actors", async () => {
    const actor = makeActor([{ id: "weapon", type: "weapon", system: { ammo: [] } }]);
    const other = makeActor([{ id: "ammo", type: "ammunition", system: { weaponId: "" } }]);
    const result = await linkAmmunition(actor.items.get("weapon"), other.items.get("ammo"));
    assert.deepEqual(result, []);
    assert.deepEqual(actor.items.get("weapon").system.ammo, []);
});

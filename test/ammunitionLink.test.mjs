import { test } from "node:test";
import assert from "node:assert/strict";

import {
    linkAmmunition,
    unlinkAmmunition,
    unlinkWeaponAmmunition
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

test("linkAmmunition replaces both previous partners", async () => {
    const actor = makeActor([
        { id: "weapon-1", type: "weapon", system: { ammo: "ammo-old" } },
        { id: "weapon-2", type: "weapon", system: { ammo: "ammo-new" } },
        { id: "ammo-old", type: "ammunition", system: { weaponId: "weapon-1" } },
        { id: "ammo-new", type: "ammunition", system: { weaponId: "weapon-2" } }
    ]);

    await linkAmmunition(actor.items.get("weapon-1"), actor.items.get("ammo-new"));

    assert.equal(actor.items.get("weapon-1").system.ammo, "ammo-new");
    assert.equal(actor.items.get("ammo-new").system.weaponId, "weapon-1");
    assert.equal(actor.items.get("weapon-2").system.ammo, "");
    assert.equal(actor.items.get("ammo-old").system.weaponId, "");
});

test("unlink helpers clear both sides of the link", async () => {
    const actor = makeActor([
        { id: "weapon", type: "weapon", system: { ammo: "ammo" } },
        { id: "ammo", type: "ammunition", system: { weaponId: "weapon" } }
    ]);
    await unlinkWeaponAmmunition(actor.items.get("weapon"));
    assert.equal(actor.items.get("weapon").system.ammo, "");
    assert.equal(actor.items.get("ammo").system.weaponId, "");

    actor.items.get("weapon").system.ammo = "ammo";
    actor.items.get("ammo").system.weaponId = "weapon";
    await unlinkAmmunition(actor.items.get("ammo"));
    assert.equal(actor.items.get("weapon").system.ammo, "");
    assert.equal(actor.items.get("ammo").system.weaponId, "");
});

test("linkAmmunition rejects documents from different actors", async () => {
    const actor = makeActor([{ id: "weapon", type: "weapon", system: { ammo: "" } }]);
    const other = makeActor([{ id: "ammo", type: "ammunition", system: { weaponId: "" } }]);
    const result = await linkAmmunition(actor.items.get("weapon"), other.items.get("ammo"));
    assert.deepEqual(result, []);
    assert.equal(actor.items.get("weapon").system.ammo, "");
});

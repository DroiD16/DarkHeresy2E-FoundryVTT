import { test } from "node:test";
import assert from "node:assert/strict";

function getProperty(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
}

function setProperty(object, path, value) {
    const keys = path.split(".");
    const leaf = keys.pop();
    const parent = keys.reduce((current, key) => current[key], object);
    parent[leaf] = value;
}

class ItemSheetV2 {
    constructor({ document } = {}) {
        this.item = document;
        this.isEditable = true;
    }

    async _prepareContext() {
        return {};
    }

    async _onFirstRender() {}
}

class FakeElement {
    listeners = new Map();

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    emit(type, target) {
        const event = { target, preventDefault() {} };
        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
}

globalThis.foundry = {
    applications: {
        api: { HandlebarsApplicationMixin: Base => class extends Base {} },
        sheets: { ItemSheetV2 },
        ux: {
            DragDrop: { implementation: class { bind() {} } },
            TextEditor: {
                implementation: {
                    enrichHTML: async value => value,
                    getDragEventData: () => ({ uuid: "dropped-item" })
                }
            }
        }
    },
    utils: {
        expandObject: value => value,
        getProperty,
        setProperty
    }
};

globalThis.game = {
    darkHeresy: {
        config: {
            focusPowerSuggestions: [],
            focusPowerTests: {},
            weaponQualities: {
                accurate: { labelKey: "accurate", hasValue: false },
                blast: { labelKey: "blast", hasValue: true, default: 1 },
                force: { labelKey: "force", hasValue: false },
                tearing: { labelKey: "tearing", hasValue: false },
                toxic: { labelKey: "toxic", hasValue: true, default: 1 }
            }
        }
    },
    i18n: {
        localize: key => key
    }
};

const { WeaponSheet } = await import("../script/sheet/weapon.js");
const { AmmunitionSheet } = await import("../script/sheet/ammunition.js");
const { PsychicPowerSheet } = await import("../script/sheet/psychic-power.js");

function makeItem(system) {
    return {
        actor: null,
        effects: [],
        isOwner: true,
        system: {
            description: "",
            ...system
        }
    };
}

test("quality editor uses each sheet's configured path and omits dead indexes", async () => {
    const weapon = new WeaponSheet({
        document: makeItem({ effect: "", specialQualities: [{ key: "unknown", value: 2 }] })
    });
    const ammunition = new AmmunitionSheet({
        document: makeItem({ effect: { specialQualities: [{ key: "blast", value: null }] } })
    });
    const psychicPower = new PsychicPowerSheet({
        document: makeItem({ effect: "", damage: { specialQualities: [{ key: "force", value: null }] } })
    });

    const weaponContext = await weapon._prepareContext({});
    const ammunitionContext = await ammunition._prepareContext({});
    const psychicContext = await psychicPower._prepareContext({});

    assert.deepEqual(weaponContext.qualityChips, [{
        key: "unknown", label: "unknown", desc: "", hasValue: false, value: 2
    }]);
    assert.equal(Object.hasOwn(weaponContext.qualityChips[0], "index"), false);
    assert.deepEqual(weaponContext.qualityOptions.map(option => option.key), [
        "accurate", "blast", "force", "tearing", "toxic"
    ]);
    assert.deepEqual(ammunitionContext.qualityOptions.map(option => option.key), ["tearing", "toxic"]);
    assert.deepEqual(psychicContext.qualityOptions.map(option => option.key), ["blast"]);
});

test("quality mutations are serialized and use the configured nested path", async () => {
    const item = makeItem({ effect: { specialQualities: [] } });
    let updateCount = 0;
    let resolveUpdates;
    const updatesFinished = new Promise(resolve => { resolveUpdates = resolve; });
    item.update = async update => {
        await new Promise(resolve => setTimeout(resolve, 5));
        const [path, value] = Object.entries(update)[0];
        setProperty(item, path, value);
        updateCount += 1;
        if (updateCount === 2) resolveUpdates();
    };

    const sheet = new AmmunitionSheet({ document: item });
    sheet.element = new FakeElement();
    await sheet._onFirstRender({}, {});

    const addControl = key => ({
        value: key,
        closest: selector => selector === ".add-quality-select" ? addControl.target : null
    });
    const blast = addControl("blast");
    addControl.target = blast;
    sheet.element.emit("change", blast);
    const toxic = addControl("toxic");
    addControl.target = toxic;
    sheet.element.emit("change", toxic);

    await updatesFinished;
    assert.deepEqual(item.system.effect.specialQualities, [
        { key: "blast", value: 1 },
        { key: "toxic", value: 1 }
    ]);
});

test("weapon drop ignores unowned ammunition and links same-actor ammunition", async () => {
    const actor = { uuid: "Actor.same" };
    const weapon = { id: "weapon", type: "weapon", actor, system: { ammo: [] } };
    const ammunition = { id: "ammo", type: "ammunition", actor, system: { weaponId: "" } };
    actor.items = [weapon, ammunition];
    actor.items.get = id => actor.items.find(item => item.id === id);
    actor.updateEmbeddedDocuments = async (_type, updates) => {
        for (const update of updates) {
            const item = actor.items.get(update._id);
            for (const [path, value] of Object.entries(update)) {
                if (path !== "_id") setProperty(item, path, value);
            }
        }
        return updates;
    };

    const sheet = new WeaponSheet({ document: weapon });
    globalThis.fromUuidSync = () => ({ type: "ammunition", actor: null });
    await assert.doesNotReject(sheet._onDrop({}));
    assert.deepEqual(weapon.system.ammo, []);

    globalThis.fromUuidSync = () => ammunition;
    await sheet._onDrop({});
    assert.deepEqual(weapon.system.ammo, ["ammo"]);
    assert.equal(ammunition.system.weaponId, "weapon");

    weapon.system.ammo = [];
    ammunition.system.weaponId = "";
    globalThis.fromUuidSync = () => ({
        ...ammunition,
        actor: { uuid: actor.uuid }
    });
    await sheet._onDrop({});
    assert.deepEqual(weapon.system.ammo, ["ammo"]);
    assert.equal(ammunition.system.weaponId, "weapon");
});

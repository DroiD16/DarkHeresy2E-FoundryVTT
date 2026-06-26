import { test } from "node:test";
import assert from "node:assert/strict";

const helpers = new Map();

globalThis.CONST = {
    ACTIVE_EFFECT_MODES: {
        CUSTOM: 10,
        MULTIPLY: 11,
        ADD: 12,
        DOWNGRADE: 13,
        UPGRADE: 14,
        OVERRIDE: 15
    }
};

globalThis.Handlebars = {
    SafeString: class {
        constructor(value) {
            this.value = value;
        }
    },
    escapeExpression: value => String(value),
    registerHelper(name, helper) {
        helpers.set(name, helper);
    }
};

globalThis.foundry = {
    applications: {
        handlebars: {
            loadTemplates: async () => {}
        }
    }
};

globalThis.game = {
    darkHeresy: {
        config: {
            focusPowerTests: {}
        }
    },
    i18n: {
        has: () => false,
        localize: key => key
    }
};

const { initializeHandlebars } = await import("../script/common/handlebars.js");
initializeHandlebars();

const effectChanges = () => helpers.get("effectChanges");

const setLegacyModes = modes => {
    Object.defineProperty(globalThis.CONST, "ACTIVE_EFFECT_MODES", {
        configurable: true,
        value: modes
    });
};

test("effectChanges uses V14 change types without reading deprecated legacy modes", () => {
    Object.defineProperty(globalThis.CONST, "ACTIVE_EFFECT_MODES", {
        configurable: true,
        get() {
            throw new Error("legacy modes accessed");
        }
    });

    assert.equal(effectChanges()({
        changes: [{ key: "system.fatigue.base", type: "add", value: "5" }]
    }), "Fatigue +5");
    assert.equal(effectChanges()({
        changes: [{ key: "system.movement.half", type: "override", value: "4" }]
    }), "Half Movement =4");
});

test("effectChanges derives V13 numeric modes from CONST.ACTIVE_EFFECT_MODES", () => {
    setLegacyModes({
        CUSTOM: 10,
        MULTIPLY: 11,
        ADD: 12,
        DOWNGRADE: 13,
        UPGRADE: 14,
        OVERRIDE: 15
    });

    assert.equal(effectChanges()({
        changes: [{ key: "system.fatigue.base", mode: 12, value: "5" }]
    }), "Fatigue +5");
    assert.equal(effectChanges()({
        changes: [{ key: "system.movement.half", mode: 15, value: "4" }]
    }), "Half Movement =4");
});

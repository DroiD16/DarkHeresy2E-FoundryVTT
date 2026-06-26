import { test } from "node:test";
import assert from "node:assert/strict";

class ActorSheetV2 {
    constructor({ actor } = {}) {
        this.actor = actor;
        this.isEditable = true;
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
        const event = {
            target,
            stopCount: 0,
            stopPropagation() {
                this.stopCount += 1;
            }
        };
        for (const listener of this.listeners.get(type) ?? []) listener(event);
        return event;
    }
}

globalThis.foundry = {
    applications: {
        api: { HandlebarsApplicationMixin: Base => class extends Base {} },
        sheets: { ActorSheetV2 }
    },
    canvas: {
        placeables: {
            MeasuredTemplate: class {}
        }
    },
    helpers: {
        media: {
            VideoHelper: {
                hasVideoExtension: () => false
            }
        }
    },
    utils: {
        expandObject: value => value
    }
};

globalThis.game = {
    i18n: {
        format: key => key,
        localize: key => key
    }
};

const { DarkHeresySheet } = await import("../script/sheet/actor/actor.js");

function makeActor() {
    const updates = [];
    const item = {
        update(update) {
            updates.push(update);
        }
    };
    return {
        actor: {
            items: {
                get: () => item
            },
            hasCondition: () => false,
            addCondition() {},
            removeCondition() {}
        },
        updates
    };
}

function makeChangeTarget(className, data = {}) {
    return {
        checked: data.checked,
        value: data.value,
        classList: {
            contains: name => name === className
        },
        closest: selector => selector === ".item" ? { dataset: { itemId: "item-id" } } : null
    };
}

function makeConditionTarget(key) {
    return {
        closest: selector => selector === ".condition" ? { dataset: { key } } : null
    };
}

test("non-editable actor sheet change controls stop propagation without mutating items", async () => {
    const { actor, updates } = makeActor();
    const sheet = new DarkHeresySheet({ actor });
    sheet.isEditable = false;
    sheet.element = new FakeElement();
    await sheet._onFirstRender({}, {});

    const event = sheet.element.emit("change", makeChangeTarget("item-cost", { value: 7 }));

    assert.equal(event.stopCount, 1);
    assert.deepEqual(updates, []);
});

test("editable actor sheet change controls still update owned items", async () => {
    const { actor, updates } = makeActor();
    const sheet = new DarkHeresySheet({ actor });
    sheet.element = new FakeElement();
    await sheet._onFirstRender({}, {});

    const event = sheet.element.emit("change", makeChangeTarget("item-installed-toggle", { checked: true }));

    assert.equal(event.stopCount, 1);
    assert.deepEqual(updates, [{ "system.installed": true }]);
});

test("condition toggles are ignored when the actor sheet is not editable", () => {
    let addCount = 0;
    let removeCount = 0;
    const sheet = new DarkHeresySheet({
        actor: {
            hasCondition: () => false,
            addCondition: () => { addCount += 1; },
            removeCondition: () => { removeCount += 1; }
        }
    });
    sheet.isEditable = false;

    sheet._onConditionToggle(makeConditionTarget("prone"));

    assert.equal(addCount, 0);
    assert.equal(removeCount, 0);
});

test("condition toggles still add or remove conditions while editable", () => {
    let added;
    let removed;
    const sheet = new DarkHeresySheet({
        actor: {
            hasCondition: key => key === "bleeding",
            addCondition: key => { added = key; },
            removeCondition: key => { removed = key; }
        }
    });

    sheet._onConditionToggle(makeConditionTarget("prone"));
    sheet._onConditionToggle(makeConditionTarget("bleeding"));

    assert.equal(added, "prone");
    assert.equal(removed, "bleeding");
});

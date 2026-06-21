import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The actor data models reference `foundry.abstract.TypeDataModel` (base class)
// and `foundry.data.fields` (at module load). Stub both before importing so the
// schema shape can be asserted without a real Foundry runtime. The field stubs
// record their type and options (and nested structure for Array/Schema).
//
// Be robust regardless of test-file isolation: if another test file already
// populated `globalThis.foundry.data` with a partial fields set (no ArrayField/
// ObjectField), overwrite `fields` with the COMPLETE set so the actor schema can
// load. Don't depend on per-file process isolation holding.
globalThis.foundry = globalThis.foundry || {};
globalThis.foundry.abstract = globalThis.foundry.abstract || { TypeDataModel: class {} };
globalThis.foundry.data = globalThis.foundry.data || {};
globalThis.foundry.data.fields = {
    StringField: class {
        constructor(o = {}) {
            this.type = "String";
            this.options = o;
        }
    },
    NumberField: class {
        constructor(o = {}) {
            this.type = "Number";
            this.options = o;
        }
    },
    BooleanField: class {
        constructor(o = {}) {
            this.type = "Boolean";
            this.options = o;
        }
    },
    SchemaField: class {
        constructor(f = {}, o = {}) {
            this.type = "Schema";
            this.fields = f;
            this.options = o;
        }
    },
    ArrayField: class {
        constructor(element, o = {}) {
            this.type = "Array";
            this.element = element;
            this.options = o;
        }
    },
    ObjectField: class {
        constructor(o = {}) {
            this.type = "Object";
            this.options = o;
        }
    }
};

const { default: AcolyteData } = await import("../script/data/actor/acolyteData.js");
const { default: NpcData } = await import("../script/data/actor/npcData.js");

// Frozen snapshot of the actor schema defaults. This fixture was generated from
// the (now removed) template.json using the same merge logic the test formerly
// applied inline (`expectedFromTemplate` + `experience.spentOther = 0`), so it
// preserves the historical expected values and guards against schema drift in
// the DataModel `defineSchema()` output.
const fixture = JSON.parse(
    readFileSync(fileURLToPath(new URL("./fixtures/actor-schema-defaults.json", import.meta.url)), "utf8")
);

/**
 * Recursively compute the default value produced by a stubbed field, mirroring
 * how Foundry would initialize the schema from its `initial` options.
 */
function defaultOf(field) {
    switch (field.type) {
        case "String":
        case "Number":
        case "Boolean":
            return field.options.initial;
        case "Array":
            return field.options.initial ?? [];
        case "Object":
            return structuredClone(field.options.initial ?? {});
        case "Schema": {
            const out = {};
            for (const [key, sub] of Object.entries(field.fields)) {
                out[key] = defaultOf(sub);
            }
            return out;
        }
        default:
            throw new Error(`Unknown field type: ${field.type}`);
    }
}

/** Apply defaultOf to every field of a defineSchema() result. */
function schemaDefaults(schema) {
    const out = {};
    for (const [key, field] of Object.entries(schema)) {
        out[key] = defaultOf(field);
    }
    return out;
}

test("AcolyteData: schema defaults deep-equal frozen actor-schema-defaults fixture (acolyte) + experience.spentOther", () => {
    const expected = fixture.acolyte;

    const actual = schemaDefaults(AcolyteData.defineSchema());

    assert.deepEqual(actual, expected);
    assert.ok("spentOther" in actual.experience, "experience.spentOther present");
    assert.equal(actual.experience.spentOther, 0);
});

test("NpcData: schema defaults deep-equal frozen actor-schema-defaults fixture (npc) + experience.spentOther", () => {
    const expected = fixture.npc;

    const actual = schemaDefaults(NpcData.defineSchema());

    assert.deepEqual(actual, expected);
    assert.ok("spentOther" in actual.experience, "experience.spentOther present");
    assert.equal(actual.experience.spentOther, 0);
});

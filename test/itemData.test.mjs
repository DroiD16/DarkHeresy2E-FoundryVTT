import { test } from "node:test";
import assert from "node:assert/strict";

// The data models reference `foundry.abstract.TypeDataModel` (as a base class)
// and `foundry.data.fields` (at module load). Stub both before importing so the
// schema shape can be asserted without a real Foundry runtime. The field stubs
// simply record their type and options.
globalThis.foundry = globalThis.foundry || {};
globalThis.foundry.abstract = globalThis.foundry.abstract || { TypeDataModel: class {} };
globalThis.foundry.data = globalThis.foundry.data || {
    fields: {
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
        }
    }
};

const { default: ItemDescriptionData } = await import("../script/data/item/itemDescriptionData.js");
const { default: TraitData } = await import("../script/data/item/traitData.js");
const { default: SpecialAbilityData } = await import("../script/data/item/specialAbilityData.js");
const { default: CriticalInjuryData } = await import("../script/data/item/criticalInjuryData.js");

test("ItemDescriptionData: schema is exactly [description, source], both String initial ''", () => {
    const schema = ItemDescriptionData.defineSchema();
    assert.deepEqual(Object.keys(schema), ["description", "source"]);
    assert.equal(schema.description.type, "String");
    assert.equal(schema.description.options.initial, "");
    assert.equal(schema.source.type, "String");
    assert.equal(schema.source.options.initial, "");
});

test("TraitData: inherits description+source and appends benefit (String '')", () => {
    const schema = TraitData.defineSchema();
    for (const key of ["description", "source", "benefit"]) {
        assert.ok(key in schema, `key ${key} present`);
    }
    assert.equal(schema.description.type, "String");
    assert.equal(schema.source.type, "String");
    assert.equal(schema.benefit.type, "String");
    assert.equal(schema.benefit.options.initial, "");
});

test("SpecialAbilityData: inherits description+source and appends benefit (String '')", () => {
    const schema = SpecialAbilityData.defineSchema();
    for (const key of ["description", "source", "benefit"]) {
        assert.ok(key in schema, `key ${key} present`);
    }
    assert.equal(schema.benefit.type, "String");
    assert.equal(schema.benefit.options.initial, "");
});

test("CriticalInjuryData: inherits description+source and appends type='impact', part='body'", () => {
    const schema = CriticalInjuryData.defineSchema();
    for (const key of ["description", "source", "type", "part"]) {
        assert.ok(key in schema, `key ${key} present`);
    }
    assert.equal(schema.type.type, "String");
    assert.equal(schema.type.options.initial, "impact");
    assert.equal(schema.part.type, "String");
    assert.equal(schema.part.options.initial, "body");
});

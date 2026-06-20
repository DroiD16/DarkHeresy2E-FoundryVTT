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
        }
    }
};

const { default: ItemDescriptionData } = await import("../script/data/item/itemDescriptionData.js");
const { default: TraitData } = await import("../script/data/item/traitData.js");
const { default: SpecialAbilityData } = await import("../script/data/item/specialAbilityData.js");
const { default: CriticalInjuryData } = await import("../script/data/item/criticalInjuryData.js");
const { default: ArmourData } = await import("../script/data/item/armourData.js");
const { default: CyberneticData } = await import("../script/data/item/cyberneticData.js");
const { default: DrugData } = await import("../script/data/item/drugData.js");
const { default: ForceFieldData } = await import("../script/data/item/forceFieldData.js");
const { default: GearData } = await import("../script/data/item/gearData.js");
const { default: ToolData } = await import("../script/data/item/toolData.js");
const { default: WeaponModificationData } = await import("../script/data/item/weaponModificationData.js");

const EQUIPMENT_KEYS = ["craftsmanship", "description", "availability", "weight"];

function assertInheritsEquipment(schema) {
    for (const key of EQUIPMENT_KEYS) {
        assert.ok(key in schema, `inherited equipment key ${key} present`);
    }
    assert.equal(schema.craftsmanship.type, "String");
    assert.equal(schema.craftsmanship.options.initial, "common");
    assert.equal(schema.description.type, "String");
    assert.equal(schema.description.options.initial, "");
    assert.equal(schema.availability.type, "String");
    assert.equal(schema.availability.options.initial, "common");
    assert.equal(schema.weight.type, "Number");
    assert.equal(schema.weight.options.initial, 0);
}

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

test("ArmourData: inherits equipment fields and appends armour own fields", () => {
    const schema = ArmourData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.type.type, "String");
    assert.equal(schema.type.options.initial, "basic");
    assert.equal(schema.isAdditive.type, "Boolean");
    assert.equal(schema.isAdditive.options.initial, false);
    assert.equal(schema.maxAgility.type, "Number");
    assert.equal(schema.maxAgility.options.initial, 0);
    assert.equal(schema.part.type, "Schema");
    for (const loc of ["head", "leftArm", "rightArm", "body", "leftLeg", "rightLeg"]) {
        assert.ok(loc in schema.part.fields, `part location ${loc} present`);
        assert.equal(schema.part.fields[loc].type, "Number");
        assert.equal(schema.part.fields[loc].options.initial, 0);
    }
});

test("CyberneticData: inherits equipment fields and appends installed (Boolean false)", () => {
    const schema = CyberneticData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.installed.type, "Boolean");
    assert.equal(schema.installed.options.initial, false);
});

test("DrugData: inherits equipment fields and appends shortDescription (String '')", () => {
    const schema = DrugData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.shortDescription.type, "String");
    assert.equal(schema.shortDescription.options.initial, "");
});

test("ForceFieldData: inherits equipment fields and appends protectionRating/overloadChance (Number 0)", () => {
    const schema = ForceFieldData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.protectionRating.type, "Number");
    assert.equal(schema.protectionRating.options.initial, 0);
    assert.equal(schema.overloadChance.type, "Number");
    assert.equal(schema.overloadChance.options.initial, 0);
});

test("GearData: inherits equipment fields and appends shortDescription (String '')", () => {
    const schema = GearData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.shortDescription.type, "String");
    assert.equal(schema.shortDescription.options.initial, "");
});

test("ToolData: inherits equipment fields and appends shortDescription (String '')", () => {
    const schema = ToolData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.shortDescription.type, "String");
    assert.equal(schema.shortDescription.options.initial, "");
});

test("WeaponModificationData: inherits equipment fields and appends upgrades (String '') and installed (Boolean false)", () => {
    const schema = WeaponModificationData.defineSchema();
    assertInheritsEquipment(schema);
    assert.equal(schema.upgrades.type, "String");
    assert.equal(schema.upgrades.options.initial, "");
    assert.equal(schema.installed.type, "Boolean");
    assert.equal(schema.installed.options.initial, false);
});

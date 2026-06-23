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
        },
        ArrayField: class {
            constructor(e = {}, o = {}) {
                this.type = "Array";
                this.element = e;
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
const { default: PsychicPowerData } = await import("../script/data/item/psychicPowerData.js");
const { default: TalentData } = await import("../script/data/item/talentData.js");
const { default: AmmunitionData } = await import("../script/data/item/ammunitionData.js");

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

test("PsychicPowerData: inherits description+source and appends psychic power own fields", () => {
    const schema = PsychicPowerData.defineSchema();

    // Inherited from ItemDescriptionData
    for (const key of ["description", "source"]) {
        assert.ok(key in schema, `inherited key ${key} present`);
    }
    assert.equal(schema.description.type, "String");
    assert.equal(schema.description.options.initial, "");
    assert.equal(schema.source.type, "String");
    assert.equal(schema.source.options.initial, "");

    // cost is numeric
    assert.equal(schema.cost.type, "Number");
    assert.equal(schema.cost.options.initial, 0);

    // Remaining own string fields, all String initial ""
    for (const key of ["shortDescription", "prerequisite", "action", "range", "sustained", "subtype", "effect"]) {
        assert.ok(key in schema, `own key ${key} present`);
        assert.equal(schema[key].type, "String");
        assert.equal(schema[key].options.initial, "");
    }

    // focusPower is a Schema: difficulty (Number 0) + test (String "")
    assert.equal(schema.focusPower.type, "Schema");
    assert.equal(schema.focusPower.fields.difficulty.type, "Number");
    assert.equal(schema.focusPower.fields.difficulty.options.initial, 0);
    assert.equal(schema.focusPower.fields.test.type, "String");
    assert.equal(schema.focusPower.fields.test.options.initial, "");

    // damage is a Schema: zone (String "bolt"), type (String "energy"),
    // formula/penetration/special (String "")
    assert.equal(schema.damage.type, "Schema");
    assert.equal(schema.damage.fields.zone.type, "String");
    assert.equal(schema.damage.fields.zone.options.initial, "bolt");
    assert.equal(schema.damage.fields.type.type, "String");
    assert.equal(schema.damage.fields.type.options.initial, "energy");
    for (const key of ["formula", "penetration", "special"]) {
        assert.equal(schema.damage.fields[key].type, "String", `damage.${key} is String`);
        assert.equal(schema.damage.fields[key].options.initial, "", `damage.${key} initial ""`);
    }

    // damage.specialQualities is the structured chip array: an ArrayField of a
    // Schema {key: String required/non-blank, value: Number nullable/min 0/int}.
    assert.equal(schema.damage.fields.specialQualities.type, "Array");
    const quality = schema.damage.fields.specialQualities.element;
    assert.equal(quality.type, "Schema");
    assert.equal(quality.fields.key.type, "String");
    assert.equal(quality.fields.key.options.required, true);
    assert.equal(quality.fields.key.options.blank, false);
    assert.equal(quality.fields.value.type, "Number");
    assert.equal(quality.fields.value.options.nullable, true);
    assert.equal(quality.fields.value.options.initial, null);
    assert.equal(quality.fields.value.options.min, 0);
    assert.equal(quality.fields.value.options.integer, true);
});

test("AmmunitionData: inherits equipment fields and appends effect.specialQualities", () => {
    const schema = AmmunitionData.defineSchema();
    assertInheritsEquipment(schema);

    // effect is a Schema; the free-text special field is retained (String "").
    assert.equal(schema.effect.type, "Schema");
    assert.equal(schema.effect.fields.special.type, "String");
    assert.equal(schema.effect.fields.special.options.initial, "");

    // effect.specialQualities is the structured chip array: an ArrayField of a
    // Schema {key: String required/non-blank, value: Number nullable/min 0/int}.
    assert.equal(schema.effect.fields.specialQualities.type, "Array");
    const quality = schema.effect.fields.specialQualities.element;
    assert.equal(quality.type, "Schema");
    assert.equal(quality.fields.key.type, "String");
    assert.equal(quality.fields.key.options.required, true);
    assert.equal(quality.fields.key.options.blank, false);
    assert.equal(quality.fields.value.type, "Number");
    assert.equal(quality.fields.value.options.nullable, true);
    assert.equal(quality.fields.value.options.initial, null);
    assert.equal(quality.fields.value.options.min, 0);
    assert.equal(quality.fields.value.options.integer, true);
});

test("TalentData: inherits description+source and appends talent own fields", () => {
    const schema = TalentData.defineSchema();

    // Inherited from ItemDescriptionData
    for (const key of ["description", "source"]) {
        assert.ok(key in schema, `inherited key ${key} present`);
    }
    assert.equal(schema.description.type, "String");
    assert.equal(schema.description.options.initial, "");
    assert.equal(schema.source.type, "String");
    assert.equal(schema.source.options.initial, "");

    // Own string fields, all String initial ""
    for (const key of ["prerequisites", "aptitudes", "benefit"]) {
        assert.ok(key in schema, `own key ${key} present`);
        assert.equal(schema[key].type, "String");
        assert.equal(schema[key].options.initial, "");
    }

    // tier and cost are numeric
    assert.equal(schema.tier.type, "Number");
    assert.equal(schema.tier.options.initial, 0);
    assert.equal(schema.cost.type, "Number");
    assert.equal(schema.cost.options.initial, 0);

    // starter is boolean
    assert.equal(schema.starter.type, "Boolean");
    assert.equal(schema.starter.options.initial, false);
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

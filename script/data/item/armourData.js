import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class ArmourData extends EquipmentItemData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            type: new fields.StringField({ initial: "basic" }),
            isAdditive: new fields.BooleanField({ initial: false }),
            part: new fields.SchemaField({
                head: new fields.NumberField({ initial: 0 }),
                leftArm: new fields.NumberField({ initial: 0 }),
                rightArm: new fields.NumberField({ initial: 0 }),
                body: new fields.NumberField({ initial: 0 }),
                leftLeg: new fields.NumberField({ initial: 0 }),
                rightLeg: new fields.NumberField({ initial: 0 })
            }),
            maxAgility: new fields.NumberField({ initial: 0 })
        };
    }
}

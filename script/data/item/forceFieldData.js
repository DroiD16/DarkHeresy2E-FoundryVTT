import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class ForceFieldData extends EquipmentItemData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            protectionRating: new fields.NumberField({ initial: 0 }),
            overloadChance: new fields.NumberField({ initial: 0 })
        };
    }
}

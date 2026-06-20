import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class ToolData extends EquipmentItemData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            shortDescription: new fields.StringField({ initial: "" })
        };
    }
}

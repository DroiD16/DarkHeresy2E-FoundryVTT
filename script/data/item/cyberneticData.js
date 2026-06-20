import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class CyberneticData extends EquipmentItemData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            installed: new fields.BooleanField({ initial: false })
        };
    }
}

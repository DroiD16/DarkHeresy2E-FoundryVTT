import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class WeaponModificationData extends EquipmentItemData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            upgrades: new fields.StringField({ initial: "" }),
            installed: new fields.BooleanField({ initial: false })
        };
    }
}

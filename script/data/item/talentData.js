import ItemDescriptionData from "./itemDescriptionData.js";

const fields = foundry.data.fields;

export default class TalentData extends ItemDescriptionData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...base,
            prerequisites: new fields.StringField({ initial: "" }),
            aptitudes: new fields.StringField({ initial: "" }),
            benefit: new fields.StringField({ initial: "" }),
            tier: new fields.NumberField({ initial: 0 }),
            starter: new fields.BooleanField({ initial: false }),
            // `cost` is numeric (template default 0, sheet input data-dtype="Number").
            // The actor's auto-XP code writes a derived value here transiently during
            // prepareDerivedData; NumberField also cleans any legacy string cost.
            cost: new fields.NumberField({ initial: 0 })
        };
    }
}

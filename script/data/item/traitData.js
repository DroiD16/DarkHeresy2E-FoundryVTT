import ItemDescriptionData from "./itemDescriptionData.js";

const fields = foundry.data.fields;

export default class TraitData extends ItemDescriptionData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...base,
            benefit: new fields.StringField({ initial: "" })
        };
    }
}

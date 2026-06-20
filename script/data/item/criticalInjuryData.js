import ItemDescriptionData from "./itemDescriptionData.js";

const fields = foundry.data.fields;

export default class CriticalInjuryData extends ItemDescriptionData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...base,
            type: new fields.StringField({ initial: "impact" }),
            part: new fields.StringField({ initial: "body" })
        };
    }
}

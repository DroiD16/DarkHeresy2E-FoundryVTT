import ItemDescriptionData from "./itemDescriptionData.js";

const fields = foundry.data.fields;

export default class PsychicPowerData extends ItemDescriptionData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...base,
            shortDescription: new fields.StringField({ initial: "" }),
            cost: new fields.NumberField({ initial: 0 }),
            prerequisite: new fields.StringField({ initial: "" }),
            action: new fields.StringField({ initial: "" }),
            focusPower: new fields.SchemaField({
                difficulty: new fields.NumberField({ initial: 0 }),
                test: new fields.StringField({ initial: "" })
            }),
            range: new fields.StringField({ initial: "" }),
            sustained: new fields.StringField({ initial: "" }),
            subtype: new fields.StringField({ initial: "" }),
            // Rich-text string (enriched by the sheet)
            effect: new fields.StringField({ initial: "" }),
            damage: new fields.SchemaField({
                zone: new fields.StringField({ initial: "bolt" }),
                type: new fields.StringField({ initial: "energy" }),
                formula: new fields.StringField({ initial: "" }),
                penetration: new fields.StringField({ initial: "" }),
                special: new fields.StringField({ initial: "" })
            })
        };
    }
}

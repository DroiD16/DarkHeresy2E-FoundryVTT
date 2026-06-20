import DarkHeresyActorData from "./actorBaseData.js";

const fields = foundry.data.fields;

/**
 * Acolyte actor data model. Extends the shared base (the seven templates) and
 * adds the acolyte-specific keys transcribed from template.json Actor.acolyte.
 *
 * `experience.spentOther` is a stored, user-entered number that exists on every
 * real actor but is missing from template.json. It is included here so existing
 * world data validates without loss. The remaining experience.spent* values and
 * totalSpent/remaining are derived at runtime and are NOT part of this schema.
 */
export default class AcolyteData extends DarkHeresyActorData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            bio: new fields.SchemaField({
                homeWorld: new fields.StringField({ initial: "" }),
                background: new fields.StringField({ initial: "" }),
                role: new fields.StringField({ initial: "" }),
                elite: new fields.StringField({ initial: "" }),
                divination: new fields.StringField({ initial: "" }),
                gender: new fields.StringField({ initial: "" }),
                age: new fields.StringField({ initial: "" }),
                build: new fields.StringField({ initial: "" }),
                complexion: new fields.StringField({ initial: "" }),
                hair: new fields.StringField({ initial: "" }),
                quirks: new fields.StringField({ initial: "" }),
                superstition: new fields.StringField({ initial: "" }),
                momentos: new fields.StringField({ initial: "" }),
                notes: new fields.StringField({ initial: "" })
            }),
            experience: new fields.SchemaField({
                value: new fields.NumberField({ initial: 0 }),
                spentOther: new fields.NumberField({ initial: 0 })
            }),
            insanity: new fields.NumberField({ initial: 0 }),
            corruption: new fields.NumberField({ initial: 0 }),
            aptitudes: new fields.ObjectField({ initial: {} }),
            size: new fields.NumberField({ initial: 4 })
        };
    }
}

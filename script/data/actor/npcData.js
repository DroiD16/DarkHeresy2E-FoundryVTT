import DarkHeresyActorData from "./actorBaseData.js";

const fields = foundry.data.fields;

/**
 * NPC actor data model. Extends the shared base (the seven templates) and adds
 * the npc-specific keys transcribed from template.json Actor.npc.
 *
 * `experience.spentOther` is added for parity with acolytes: the shared
 * _computeExperience derived calculation reads it for npcs too. Derived
 * experience values are computed at runtime and are NOT part of this schema.
 */
export default class NpcData extends DarkHeresyActorData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            ...base,
            experience: new fields.SchemaField({
                value: new fields.NumberField({ initial: 0 }),
                spentOther: new fields.NumberField({ initial: 0 })
            }),
            faction: new fields.StringField({ initial: "" }),
            subfaction: new fields.StringField({ initial: "" }),
            type: new fields.StringField({ initial: "troop" }),
            threatLevel: new fields.NumberField({ initial: 0 }),
            size: new fields.NumberField({ initial: 4 }),
            notes: new fields.StringField({ initial: "" })
        };
    }
}

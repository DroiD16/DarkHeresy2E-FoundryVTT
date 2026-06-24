import ItemDescriptionData from "./itemDescriptionData.js";
import { parseTalentAptitudes } from "../../common/talent-aptitudes.js";

const fields = foundry.data.fields;

/**
 * Pure XP-cost formula for a talent. No Foundry globals so it can be unit-tested.
 *
 * Reproduces the original auto-XP formula: a starter talent or a tier outside
 * 1..3 costs 0; otherwise the cost is `talentCosts[tier-1][2-matched]` where
 * `matched` is how many of the talent's aptitudes the character has, CAPPED AT 2
 * (Dark Heresy 2E: a talent is bought at the best-of-two-aptitudes tier; matching
 * three or more never costs less than matching two). The cap also guards the
 * lookup against a negative second index now that the chip editor lets a talent
 * list more than two aptitudes.
 *
 * @param {object} talent                     Talent inputs.
 * @param {number|string} talent.tier         Talent tier (parsed with parseInt).
 * @param {boolean} talent.starter            Whether the talent is a starter talent.
 * @param {string|object[]} talent.aptitudes  The talent's aptitudes (structured
 *                                             array or legacy comma-separated string).
 * @param {string[]} characterAptitudes       Aptitude names the character has.
 * @param {number[][]} talentCosts            Cost matrix (config.talentCosts).
 * @returns {number} The XP cost.
 */
export function computeTalentCost({ tier, starter, aptitudes }, characterAptitudes, talentCosts) {
    const talentAptitudeKeys = parseTalentAptitudes(aptitudes).map(a => a.key);
    const matched = Math.min(2, characterAptitudes.filter(a => talentAptitudeKeys.includes(a)).length);
    const t = parseInt(tier);
    if (starter || !(t >= 1 && t <= 3)) return 0;
    return talentCosts[t - 1][2 - matched];
}

export default class TalentData extends ItemDescriptionData {
    static defineSchema() {
        const base = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...base,
            prerequisites: new fields.StringField({ initial: "" }),
            // Structured aptitude list, mirroring the weapon special-quality
            // shape so the shared QUALITY_EDITOR chip control can drive it. `key`
            // is a canonical English aptitude tag (matched verbatim against the
            // actor's aptitude Item names for XP cost); `value` is unused for
            // aptitudes (always null) and kept only for shape parity. Legacy
            // comma-separated strings are converted by migrateData below.
            aptitudes: new fields.ArrayField(new fields.SchemaField({
                key: new fields.StringField({ required: true, blank: false }),
                value: new fields.NumberField({
                    required: false,
                    nullable: true,
                    initial: null,
                    min: 0,
                    integer: true
                })
            })),
            benefit: new fields.StringField({ initial: "" }),
            tier: new fields.NumberField({ initial: 0 }),
            starter: new fields.BooleanField({ initial: false }),
            // `cost` is numeric (template default 0, sheet input data-dtype="Number").
            // In auto-XP mode this is recomputed as derived data below; in normal
            // mode the stored value is used. NumberField also cleans any legacy
            // string cost.
            cost: new fields.NumberField({ initial: 0 })
        };
    }

    /** @inheritdoc */
    static migrateData(source) {
        super.migrateData(source);
        // The legacy schema stored aptitudes as a single comma-separated string.
        // Convert it to the structured list BEFORE field cleaning runs, otherwise
        // ArrayField.clean would coerce the string to [] and the data would be
        // lost. Kept as a read-time safety net for imported/compendium talents the
        // one-time world migration cannot reach.
        if (typeof source.aptitudes === "string") {
            source.aptitudes = parseTalentAptitudes(source.aptitudes);
        }
        return source;
    }

    prepareDerivedData() {
        super.prepareDerivedData();
        const actor = this.parent?.actor;
        if (!actor) return; // Standalone/compendium talent keeps its stored cost
        if (!game.settings.get("dark-heresy", "autoCalcXPCosts")) return; // Normal mode keeps stored cost
        const characterAptitudes = actor.items.filter(i => i.isAptitude).map(i => i.name.trim());
        if (!characterAptitudes.includes("General")) characterAptitudes.push("General");
        this.cost = computeTalentCost(
            { tier: this.tier, starter: this.starter, aptitudes: this.aptitudes },
            characterAptitudes,
            game.darkHeresy.config.talentCosts
        );
    }
}

import ItemDescriptionData from "./itemDescriptionData.js";

const fields = foundry.data.fields;

/**
 * Pure XP-cost formula for a talent. No Foundry globals so it can be unit-tested.
 *
 * Reproduces the original auto-XP formula exactly: a starter talent or a tier
 * outside 1..3 costs 0; otherwise the cost is `talentCosts[tier-1][2-matched]`
 * where `matched` is how many of the talent's aptitudes the character has.
 *
 * @param {object} talent                     Talent inputs.
 * @param {number|string} talent.tier         Talent tier (parsed with parseInt).
 * @param {boolean} talent.starter            Whether the talent is a starter talent.
 * @param {string} talent.aptitudes           Comma-separated aptitude names.
 * @param {string[]} characterAptitudes       Aptitude names the character has.
 * @param {number[][]} talentCosts            Cost matrix (config.talentCosts).
 * @returns {number} The XP cost.
 */
export function computeTalentCost({ tier, starter, aptitudes }, characterAptitudes, talentCosts) {
    const talentAptitudes = (aptitudes ?? "").split(",").map(s => s.trim());
    const matched = characterAptitudes.filter(a => talentAptitudes.includes(a)).length;
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
            aptitudes: new fields.StringField({ initial: "" }),
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

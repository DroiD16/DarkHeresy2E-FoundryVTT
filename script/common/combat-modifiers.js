import { rangeBandModifier, rangeQualityEffects, resolveRangeBand } from "./weapon-qualities.js";

const ATTACK_TYPE_MODIFIERS = Object.freeze({
    standard: 10,
    bolt: 0,
    blast: 0,
    swift: 0,
    semi_auto: 0,
    barrage: 0,
    lightning: -10,
    full_auto: -10,
    called_shot: -20,
    charge: 20,
    allOut: 30
});

/**
 * Return the to-hit modifier for an attack type.
 * @param {string} attackTypeName
 * @returns {number}
 */
export function attackTypeModifier(attackTypeName) {
    return ATTACK_TYPE_MODIFIERS[attackTypeName] ?? 0;
}

/**
 * Apply Accurate/Inaccurate to the Aim modifier selected in the dialog.
 * @param {object} traits rollData.weapon.traits.
 * @param {number} selectedAimModifier Raw modifier selected in the Aim dropdown.
 * @returns {number}
 */
export function effectiveAimModifier(traits, selectedAimModifier) {
    const aim = Number(selectedAimModifier) || 0;
    if (traits?.inaccurate) return 0;
    return traits?.accurate && aim !== 0 ? aim + 10 : aim;
}

/**
 * Calculate every automatic modifier applied to a combat target roll.
 * Component values and total are deliberately uncapped; the +/-60 rules limit
 * applies only after the manual and automatic modifiers are combined.
 * @param {object} data
 * @param {object} data.traits
 * @param {number} data.aimModifier Effective Aim modifier.
 * @param {string} data.rangeBand
 * @param {number} data.rangeMod Legacy numeric range modifier fallback.
 * @param {string} data.attackTypeName
 * @param {number} data.actorModifier
 * @param {number} data.psyModifier
 * @returns {{aim: number, range: number, rangeQuality: number,
 * twinLinked: number, attackType: number, actor: number, psy: number, total: number}}
 */
export function computeCombatAutomationModifier({
    traits,
    aimModifier = 0,
    rangeBand,
    rangeMod = 0,
    attackTypeName,
    actorModifier = 0,
    psyModifier = 0
}) {
    const resolvedBand = resolveRangeBand(rangeBand, rangeMod);
    const range = resolvedBand ? rangeBandModifier(resolvedBand) : (Number(rangeMod) || 0);
    const rangeQuality = rangeQualityEffects(traits, resolvedBand, rangeMod).attackModifier;
    const components = {
        aim: Number(aimModifier) || 0,
        range,
        rangeQuality,
        twinLinked: traits?.twinLinked ? 20 : 0,
        attackType: attackTypeModifier(attackTypeName),
        actor: Number(actorModifier) || 0,
        psy: Number(psyModifier) || 0
    };
    return {
        ...components,
        total: Object.values(components).reduce((sum, value) => sum + value, 0)
    };
}

/**
 * Apply Dark Heresy's +/-60 cap to the combined test modifier.
 * @param {number} modifier
 * @returns {number}
 */
export function clampTestModifier(modifier) {
    return Math.max(-60, Math.min(60, Number(modifier) || 0));
}

/**
 * Convert a user-entered test modifier to a finite integer. Empty and invalid
 * values are neutral rather than poisoning the automatic modifier total.
 * @param {*} modifier
 * @returns {number}
 */
export function normalizeTestModifier(modifier) {
    const value = Number(modifier);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * Combine manual and automatic modifiers before applying the rules cap.
 * @param {*} manualModifier
 * @param {*} automationModifier
 * @returns {number}
 */
export function combineTestModifiers(manualModifier, automationModifier) {
    return clampTestModifier(
        normalizeTestModifier(manualModifier) + normalizeTestModifier(automationModifier));
}

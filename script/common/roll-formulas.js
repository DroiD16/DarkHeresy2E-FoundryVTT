/**
 * Append a numeric modifier with a normalized sign. Zero and invalid values
 * are inert, avoiding formulas such as `1d10+4+-3` or `1d10+4+NaN`.
 * @param {string} formula
 * @param {*} modifier
 * @returns {string}
 */
export function appendSignedModifier(formula, modifier) {
    const value = Number(modifier);
    if (!Number.isFinite(value) || value === 0) return formula;
    return `${formula}${value > 0 ? "+" : ""}${value}`;
}

/**
 * Build the complete damage formula shared by normal hits and Overheat.
 * Symbol replacement remains in roll.js because it depends on actor data.
 * @param {object} data
 * @param {string} data.formula
 * @param {object} data.traits
 * @param {*} data.damageBonus
 * @param {*} data.rangeDamageModifier
 * @returns {string}
 */
export function buildDamageFormula({
    formula,
    traits = {},
    damageBonus = 0,
    rangeDamageModifier = 0
}) {
    if (!formula) return "0";
    let result = formula;
    if (traits.tearing) result = appendTearing(result);
    if (traits.proven) result = appendNumberedDiceModifier(result, "min", traits.proven);
    if (traits.primitive) result = appendNumberedDiceModifier(result, "max", traits.primitive);
    result = appendSignedModifier(result, damageBonus);
    return appendSignedModifier(result, rangeDamageModifier);
}

/**
 * Add a Foundry numeric die modifier to the first dice term.
 * @param {string} formula
 * @param {string} modifier
 * @param {number} value
 * @returns {string}
 */
function appendNumberedDiceModifier(formula, modifier, value) {
    const diceRegex = /\d+d\d+/;
    if (formula.includes(modifier)) return formula;
    const match = formula.match(diceRegex);
    if (!match) return formula;
    return formula.replace(diceRegex, `${match[0]}${modifier}${value}`);
}

/**
 * Implement Tearing by rolling one extra die and dropping the lowest.
 * @param {string} formula
 * @returns {string}
 */
function appendTearing(formula) {
    const diceRegex = /\d+d\d+/;
    if (formula.match(/dl|kh/gi)) return formula;
    const match = formula.match(diceRegex);
    if (!match) return formula;
    const [number, faces] = match[0].split("d").map(Number);
    return formula.replace(diceRegex, `${number + 1}d${faces}dl`);
}

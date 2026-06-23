import { PlaceableTemplate } from "./placeable-template.js";
import { computeMalfunction, lancePenetration } from "./weapon-qualities.js";

/**
 * Roll a generic roll, and post the result to chat.
 * @param {object} rollData
 */
export async function commonRoll(rollData) {
    await _computeCommonTarget(rollData);
    await _rollTarget(rollData);
    if (rollData.flags.isEvasion) {
        rollData.numberOfHits = _computeNumberOfHits(
            rollData.attackDos,
            rollData.dos,
            rollData.attackType,
            rollData.shotsFired,
            rollData.weapon.traits);
    }
    await _sendRollToChat(rollData);
}

/**
 * Roll a combat roll, and post the result to chat.
 * @param {object} rollData
 */
export async function combatRoll(rollData) {
    if (rollData.weapon.traits.spray && game.settings.get("dark-heresy", "useSpraytemplate")) {
        let template = PlaceableTemplate.cone({ item: rollData.itemId, actor: rollData.ownerId },
            30, rollData.weapon.range);
        await template.drawPreview();
    }
    if (rollData.weapon.traits.skipAttackRoll) {
        rollData.attackResult = 5; // Attacks that skip the hit roll always hit body; 05 reversed 50 = body
        rollData.flags.isDamageRoll = true;
        await _rollDamage(rollData);
        await _updateRangedAmmo(rollData);
        await sendDamageToChat(rollData);
    } else {
        await _computeCombatTarget(rollData);
        await _rollTarget(rollData);
        rollData.attackDos = rollData.dos;
        rollData.attackResult = rollData.result;
        await _applyMalfunction(rollData);
        if (!rollData.isReRoll) {
            await _updateRangedAmmo(rollData);
        }
        rollData.numberOfHits = _computeNumberOfHits(
            rollData.attackDos,
            0,
            rollData.attackType,
            rollData.shotsFired,
            rollData.weapon.traits);
        await _sendRollToChat(rollData);
    }
}

/**
 * Roll damage for an attack and post the result to chat
 * @param {object} rollData
 */
export async function damageRoll(rollData) {
    await _rollDamage(rollData);
    await sendDamageToChat(rollData);
}

/**
 * Post an "empty clip, need to reload" message to chat.
 * @param {object} rollData
 */
export async function reportEmptyClip(rollData) {
    await _emptyClipToChat(rollData);
}

/**
 * Post a "this weapon is jammed/overheated, clear it before firing" message to
 * chat. Used by prepareCombatRoll to block firing a weapon whose persisted
 * malfunction flag is set.
 * @param {object} rollData
 */
export async function reportMalfunction(rollData) {
    let chatData = {
        user: game.user.id,
        content: await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/chat/malfunction.hbs", rollData),
        flags: {
            "dark-heresy.rollData": rollData
        }
    };
    ChatMessage.create(chatData);
}

/**
 * Compute the target value, including all +/-modifiers, for a roll.
 * @param {object} rollData
 */
async function _computeCombatTarget(rollData) {

    let attackType = 0;
    if (rollData.attackType) {
        _computeRateOfFire(rollData);
        attackType = rollData.attackType.modifier;
    }
    let psyModifier = 0;
    if (typeof rollData.psy !== "undefined" && typeof rollData.psy.useModifier !== "undefined" && rollData.psy.useModifier) {
        // Set Current Psyrating to the allowed maximum if it is bigger
        if (rollData.psy.value > rollData.psy.max) {
            rollData.psy.value = rollData.psy.max;
        }
        psyModifier = (rollData.psy.rating - rollData.psy.value) * 10;
        rollData.psy.push = psyModifier < 0;
        if (rollData.psy.push && rollData.psy.warpConduit) {
            let ratingBonus = new Roll("1d5").evaluate({ async: false }).total;
            rollData.psy.value += ratingBonus;
        }
    }

    let targetMods = rollData.target.modifier
        + (rollData.aim?.val ? rollData.aim.val : 0)
        + (rollData.rangeMod ? rollData.rangeMod : 0)
        + (rollData.weapon?.traits?.twinLinked ? 20 : 0)
        + attackType
        + psyModifier;

    rollData.target.final = _getRollTarget(targetMods, rollData.target.base);
}

/**
 * Compute the target value, including all +/-modifiers, for a roll.
 * @param {object} rollData
 */
async function _computeCommonTarget(rollData) {
    if (rollData.flags.isEvasion) {
        let skill;
        switch (rollData.evasions.selected) {
            case "dodge": skill = rollData.evasions.dodge; break;
            case "parry": skill = rollData.evasions.parry; break;
            case "deny": skill = rollData.evasions.deny; break;
        }
        rollData.target.final = _getRollTarget(rollData.target.modifier, skill.target.base);
    } else {
        rollData.target.final = _getRollTarget(rollData.target.modifier, rollData.target.base);
    }
}

/**
 * Checks and adjusts modifiers for the rolls target number and returns the final target number
 * @param {int} targetMod calculated bonuses
 * @param {int} baseTarget the intial target value to be modified
 * @returns {int} the final target number
 */
function _getRollTarget(targetMod, baseTarget) {
    if (targetMod > 60) {
        return baseTarget + 60;
    } else if (targetMod < -60) {
        return baseTarget + -60;
    } else {
        return baseTarget + targetMod;
    }
}


/**
 * Roll a d100 against a target, and apply the result to the rollData.
 * @param {object} rollData
 */
async function _rollTarget(rollData) {
    let r = new Roll("1d100", {});
    await r.evaluate();
    rollData.result = r.total;
    rollData.rollObject = r;
    rollData.flags.isSuccess = rollData.result <= rollData.target.final;
    if (rollData.flags.isSuccess) {
        rollData.dof = 0;
        rollData.dos = 1 + _getDegree(rollData.target.final, rollData.result);
    } else {
        rollData.dos = 0;
        rollData.dof = 1 + _getDegree(rollData.result, rollData.target.final);
    }
    if (rollData.psy) _computePsychicPhenomena(rollData);
}
/**
 * Handle rolling and collecting parts of a combat damage roll.
 * @param {object} rollData
 */
async function _rollDamage(rollData) {
    let formula = "0";
    rollData.damages = [];
    if (rollData.weapon.damageFormula) {
        formula = rollData.weapon.damageFormula;

        if (rollData.weapon.traits.tearing) {
            formula = _appendTearing(formula);
        }
        if (rollData.weapon.traits.proven) {
            formula = _appendNumberedDiceModifier(formula, "min", rollData.weapon.traits.proven);
        }
        if (rollData.weapon.traits.primitive) {
            formula = _appendNumberedDiceModifier(formula, "max", rollData.weapon.traits.primitive);
        }

        formula = `${formula}+${rollData.weapon.damageBonus}`;
        formula = _replaceSymbols(formula, rollData);
    }


    let penetration = await _rollPenetration(rollData);

    let firstHit = await _computeDamage(
        formula,
        penetration,
        rollData.attackDos,
        rollData.aim?.isAiming,
        rollData.weapon.traits
    );
    const firstLocation = _getLocation(rollData.attackResult);
    firstHit.location = firstLocation;
    rollData.damages.push(firstHit);

    let additionalhits = rollData.numberOfHits - 1;

    for (let i = 0; i < additionalhits; i++) {
        let additionalHit = await _computeDamage(
            formula,
            penetration,
            rollData.attackDos,
            rollData.aim?.isAiming,
            rollData.weapon.traits
        );
        additionalHit.location = _getAdditionalLocation(firstLocation, i);
        rollData.damages.push(additionalHit);
    }

    let minDamage = rollData.damages.reduce(
        (min, damage) => min.minDice < damage.minDice ? min : damage, rollData.damages[0]);

    if (minDamage.minDice < rollData.dos) {
        minDamage.total += (rollData.dos - minDamage.minDice);
    }
}

/**
 * Calculates the amount of hits of a successful attack
 * @param {int} attackDos Degrees of success on the Attack
 * @param {int} evasionDos Degrees of success on the Evasion
 * @param {object} attackType The mode of attack and its parameters
 * @param {int} shotsFired Number actually achiveable hits
 * @param {object} weaponTraits The traits of the weapon used for the attack
 * @returns {int}  the number of hits the attack has scrored
 */
function _computeNumberOfHits(attackDos, evasionDos, attackType, shotsFired, weaponTraits) {

    let stormMod = weaponTraits.storm ? 2 : 1;
    let maxHits = attackType.maxHits * stormMod;

    if (weaponTraits.twinLinked && attackDos >= 2) {
        maxHits += 1;
        attackDos += attackType.hitMargin;
        if (shotsFired) shotsFired += 1;
    }

    let hits = (1 + Math.floor((attackDos - 1) / attackType.hitMargin)) * stormMod;

    if (shotsFired && shotsFired < maxHits) {
        maxHits = shotsFired;
    }

    if (hits > maxHits) {
        hits = maxHits;
    }

    hits -= evasionDos;

    if (hits <= 0) {
        return 0;
    } else {
        return hits;
    }
}

/**
 * Roll and compute damage.
 * @param {string} damageFormula
 * @param {number} penetration
 * @param {number} dos
 * @param {boolean} isAiming
 * @param {object} weaponTraits
 * @returns {object}
 */
async function _computeDamage(damageFormula, penetration, dos, isAiming, weaponTraits) {
    let r = new Roll(damageFormula);
    await r.evaluate();
    let damage = {
        total: r.total,
        righteousFury: 0,
        dices: [],
        penetration: penetration,
        dos: dos,
        formula: damageFormula,
        replaced: false,
        damageRender: await r.render(),
        damageRoll: r
    };

    if (weaponTraits.accurate && isAiming) {
        let numDice = ~~((dos - 1) / 2); // -1 because each degree after the first counts
        if (numDice >= 1) {
            if (numDice > 2) numDice = 2;
            let ar = new Roll(`${numDice}d10`);
            await ar.evaluate();
            damage.total += ar.total;
            ar.terms.flatMap(term => term.results).forEach(async die => {
                if (die.active && die.result < dos) damage.dices.push(die.result);
                if (die.active && (typeof damage.minDice === "undefined" || die.result < damage.minDice)) damage.minDice = die.result;
            });
            damage.accurateRender = await ar.render();
        }
    }

    for await (const term of r.terms) {
        if (typeof term === "object" && term !== null) {
            let rfFace = weaponTraits.rfFace ? weaponTraits.rfFace : term.faces; // Without the Vengeful weapon trait rfFace is undefined
            for await (const result of term.results ?? []) {
                let dieResult = result.count ? result.count : result.result; // Result.count = actual value if modified by term
                if (result.active && dieResult >= rfFace) damage.righteousFury = await _rollRighteousFury();
                if (result.active && dieResult < dos) damage.dices.push(dieResult);
                if (result.active && (typeof damage.minDice === "undefined" || dieResult < damage.minDice)) damage.minDice = dieResult;
            }
        }
    }
    return damage;
}

/**
 * Reduce Ammo of the used Weapon
 * @param {object} rollData
 * @returns {Promise}
 */
async function _updateRangedAmmo(rollData) {
    let firerate = 1;
    let mod = rollData.weapon.traits.storm || rollData.weapon.traits.twinLinked ? 2 : 1;
    // Maximal fires a tripled charge: x3 ammo on a single shot (Core Rulebook
    // p. 148). Applied to standard/called_shot only; auto-burst x3 is not
    // automated (the partial-burst ammo model does not cleanly support it, and
    // it cannot be live-tested here) — the table tracks the extra burst rounds.
    let maximalMod = rollData.maximal ? 3 : 1;
    if (rollData.weapon.isRange && rollData.weapon.clip.max > 0) {
        if (rollData.weapon.clip.value < 1) {
            return;
        }
        let weapon = game.actors.get(rollData.ownerId)?.items?.get(rollData.itemId);
        if (weapon) {
            switch (rollData.attackType.name) {
                case "standard":
                case "called_shot": {
                    // Maximal consumes a 3-round charge; clamp at 0 so a clip
                    // with 1-2 rounds left does not store a negative value.
                    rollData.weapon.clip.value = Math.max(0, rollData.weapon.clip.value - (firerate * maximalMod));
                    break;
                }
                case "semi_auto": {
                    firerate = rollData.weapon.rateOfFire.burst * mod;
                    if (rollData.weapon.clip.value < firerate) {
                        rollData.shotsFired = rollData.weapon.clip.value;
                        rollData.weapon.clip.value = 0;
                    } else {
                        rollData.weapon.clip.value -= firerate;
                    }
                    break;
                }
                case "full_auto": {
                    firerate = rollData.weapon.rateOfFire.full * mod;
                    if (rollData.weapon.clip.value < firerate) {
                        rollData.shotsFired = rollData.weapon.clip.value;
                        rollData.weapon.clip.value = 0;
                    } else {
                        rollData.weapon.clip.value -= firerate;
                    }
                    break;
                }
            }
            await weapon.update({ "system.clip.value": rollData.weapon.clip.value });
        }
    }
}

/**
 * Detect a weapon jam or overheat on the attack roll, announce it (via the
 * combat chat card, which reads rollData.malfunction), and persist the state on
 * the weapon so firing is blocked until the player clears it on the sheet.
 *
 * A jam makes the triggering attack automatically miss (Core Rulebook p. 224);
 * an Overheat does not (the shot still resolves, the weapon just overheats).
 * There is no round-tracking or clear-jam action; the persisted flag blocks the
 * NEXT shot only. For an Overheat, the wielder takes Energy damage equal to the
 * weapon's rolled damage at Pen 0 to an arm — the number is SHOWN (not
 * auto-applied), consistent with how the system surfaces damage.
 *
 * Sets rollData.malfunction SYNCHRONOUSLY (before the chat send reads it); the
 * weapon.update persists the flag so firing is blocked until the player clears
 * it on the sheet. On a Fate reroll the same rollData carries the discarded
 * roll's malfunction, so a clean reroll drops the TRANSIENT field (else the
 * reroll card would still show the old jam); the PERSISTED flag is left for the
 * player to clear (their explicit decision: detection sets it, the player clears
 * it — no auto-clear / round-tracking / clear-jam action).
 * @param {object} rollData
 */
async function _applyMalfunction(rollData) {
    const type = computeMalfunction(
        rollData.weapon.traits, rollData.result, rollData.attackType?.name, rollData.weapon.isRange);
    if (!type) {
        // Clean roll: drop any stale malfunction carried over from a discarded
        // reroll so the reroll card does not show the old jam. The persisted
        // weapon flag is intentionally left for the player to clear on the sheet.
        delete rollData.malfunction;
        return;
    }
    rollData.malfunction = { type, jammed: type === "jammed", overheated: type === "overheated" };
    if (type === "jammed") {
        // A jammed shot automatically misses (Core Rulebook p. 224). The d100
        // already resolved; on the rare high-target roll where a jam value
        // (94+/96+) would otherwise be a success, convert it to a miss: clear the
        // success flag and the success-derived degrees so the card shows a clean
        // failure with no lingering DoS/hits. Overheat does NOT auto-miss.
        rollData.flags.isSuccess = false;
        rollData.dos = 0;
        rollData.attackDos = 0;
        if (!rollData.dof) rollData.dof = 1;
    }
    if (type === "overheated") {
        const formula = _replaceSymbols(rollData.weapon.damageFormula || "0", rollData);
        let r = new Roll(formula);
        await r.evaluate();
        rollData.malfunction.selfDamage = r.total;
    }
    const weapon = game.actors.get(rollData.ownerId)?.items?.get(rollData.itemId);
    if (weapon) await weapon.update({ "system.malfunction": type });
}

/**
 * Evaluate final penetration, by leveraging the dice roll API.
 * @param {object} rollData
 * @returns {number}
 */
async function _rollPenetration(rollData) {
    let penetration = (rollData.weapon.penetrationFormula) ? _replaceSymbols(rollData.weapon.penetrationFormula, rollData) : "0";
    let multiplier = 1;

    if (rollData.dos >= 3) {
        if (penetration.includes("(")) // Legacy Support
        {
            let rsValue = penetration.match(/\(\d+\)/gi); // Get Razorsharp Value
            penetration = penetration.replace(/\d+.*\(\d+\)/gi, rsValue); // Replace construct BaseValue(RazorsharpValue) with the extracted date
        } else if (rollData.weapon.traits.razorSharp) {
            multiplier = 2;
        }
    }
    let r = new Roll(penetration.toString());
    await r.evaluate();
    let total = r.total * multiplier;
    // Lance: add the weapon's BASE penetration once per degree of success. Only
    // the base scales per DoS — additive ammo/Force(+PR)/Maximal bonuses already
    // folded into `total` are NOT multiplied. basePenetration is captured
    // pre-bonus in createWeaponRollData; rollData.dos is absent on the Spray/
    // skipAttackRoll path, where lancePenetration clamps it to 0 (no NaN).
    if (rollData.weapon.traits.lance) {
        const baseFormula = _replaceSymbols(String(rollData.weapon.basePenetration ?? "0"), rollData);
        const baseRoll = new Roll(baseFormula);
        await baseRoll.evaluate();
        total = lancePenetration(total, baseRoll.total, rollData.dos);
    }
    return total;
}

/**
 * Roll a Righteous Fury dice, and return the value.
 * @returns {Promise<number>}
 */
async function _rollRighteousFury() {
    let r = new Roll("1d5");
    await r.evaluate();
    return r.total;
}

/**
 * Check for psychic phenomena (i.e, the user rolled two matching numbers, etc.), and add the result to the rollData.
 * @param {object} rollData
 */
function _computePsychicPhenomena(rollData) {
    rollData.psy.hasPhenomena = rollData.psy.push ? !_isDouble(rollData.result) : _isDouble(rollData.result);

    // Suggested modifier for the SEPARATE Psychic Phenomena roll (1d100 on
    // Table 6-2). This is independent of the focus test above: sustaining only
    // affects the focus roll via the reduced effective rating (Part 1), and it
    // affects the phenomena roll here. Two different rolls, no double-count.
    const sustained = rollData.psy.sustained ?? 0;
    // +10 per sustained power AFTER the first.
    const sustainBonus = 10 * Math.max(0, sustained - 1);
    // Points pushed above the effective base.
    const pushPts = Math.max(0, (rollData.psy.value ?? 0) - (rollData.psy.rating ?? 0));
    let classBonus;
    if (pushPts > 0) {
        // Per-push bonus when pushing. Bound psykers get none.
        classBonus = rollData.psy.class === "unbound" ? Math.min(5 * pushPts, 20)
            : rollData.psy.class === "daemonic" ? Math.min(10 * pushPts, 30)
                : 0;
    } else {
        // Flat class modifier when not pushing.
        classBonus = (rollData.psy.class === "unbound" || rollData.psy.class === "daemonic") ? 10 : 0;
    }
    rollData.psy.phenomenaModifier = sustainBonus + classBonus;
}

/**
 * Check if a number (d100 roll) has two matching digits.
 * @param {number} number
 * @returns {boolean}
 */
function _isDouble(number) {
    if (number === 100) {
        return true;
    } else {
        const digit = number % 10;
        return number - digit === digit * 10;
    }
}

/**
 * Get the hit location from a WS/BS roll.
 * @param {number} result
 * @returns {string}
 */
function _getLocation(result) {
    const toReverse = result < 10 ? `0${result}` : result.toString();
    const locationTarget = parseInt(toReverse.split("").reverse().join(""));
    if (locationTarget <= 10) {
        return "ARMOUR.HEAD";
    } else if (locationTarget <= 20) {
        return "ARMOUR.RIGHT_ARM";
    } else if (locationTarget <= 30) {
        return "ARMOUR.LEFT_ARM";
    } else if (locationTarget <= 70) {
        return "ARMOUR.BODY";
    } else if (locationTarget <= 85) {
        return "ARMOUR.RIGHT_LEG";
    } else if (locationTarget <= 100) {
        return "ARMOUR.LEFT_LEG";
    } else {
        return "ARMOUR.BODY";
    }
}

/**
 * Calculate modifiers/etc. from RoF type, and add them to the rollData.
 * @param {object} rollData
 */
function _computeRateOfFire(rollData) {
    switch (rollData.attackType.name) {
        case "standard":
            rollData.attackType.modifier = 10;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = 1;
            break;

        case "bolt":
        case "blast":
            rollData.attackType.modifier = 0;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = 1;
            break;

        case "swift":
        case "semi_auto":
        case "barrage":
            rollData.attackType.modifier = 0;
            rollData.attackType.hitMargin = 2;
            rollData.attackType.maxHits = rollData.weapon.rateOfFire.burst;
            break;

        case "lightning":
        case "full_auto":
            rollData.attackType.modifier = -10;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = rollData.weapon.rateOfFire.full;
            break;

        case "called_shot":
            rollData.attackType.modifier = -20;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = 1;
            break;

        case "charge":
            rollData.attackType.modifier = 20;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = 1;
            break;

        case "allOut":
            rollData.attackType.modifier = 30;
            rollData.attackType.hitMargin = 1;
            rollData.attackType.maxHits = 1;
            break;

        default:
            rollData.attackType.modifier = 0;
            rollData.attackType.hitMargin = 0;
            rollData.attackType.maxHits = 1;
            break;
    }
}

const additionalHit = {
    head: ["ARMOUR.HEAD", "ARMOUR.RIGHT_ARM", "ARMOUR.BODY", "ARMOUR.LEFT_ARM", "ARMOUR.BODY"],
    rightArm: ["ARMOUR.RIGHT_ARM", "ARMOUR.RIGHT_ARM", "ARMOUR.HEAD", "ARMOUR.BODY", "ARMOUR.RIGHT_ARM"],
    leftArm: ["ARMOUR.LEFT_ARM", "ARMOUR.LEFT_ARM", "ARMOUR.HEAD", "ARMOUR.BODY", "ARMOUR.LEFT_ARM"],
    body: ["ARMOUR.BODY", "ARMOUR.RIGHT_ARM", "ARMOUR.HEAD", "ARMOUR.LEFT_ARM", "ARMOUR.BODY"],
    rightLeg: ["ARMOUR.RIGHT_LEG", "ARMOUR.BODY", "ARMOUR.RIGHT_ARM", "ARMOUR.HEAD", "ARMOUR.BODY"],
    leftLeg: ["ARMOUR.LEFT_LEG", "ARMOUR.BODY", "ARMOUR.LEFT_ARM", "ARMOUR.HEAD", "ARMOUR.BODY"]
};

/**
 * Get successive hit locations for an attack which scored multiple hits.
 * @param {string} firstLocation
 * @param {number} numberOfHit
 * @returns {string}
 */
function _getAdditionalLocation(firstLocation, numberOfHit) {
    if (firstLocation === "ARMOUR.HEAD") {
        return _getLocationByIt(additionalHit.head, numberOfHit);
    } else if (firstLocation === "ARMOUR.RIGHT_ARM") {
        return _getLocationByIt(additionalHit.rightArm, numberOfHit);
    } else if (firstLocation === "ARMOUR.LEFT_ARM") {
        return _getLocationByIt(additionalHit.leftArm, numberOfHit);
    } else if (firstLocation === "ARMOUR.BODY") {
        return _getLocationByIt(additionalHit.body, numberOfHit);
    } else if (firstLocation === "ARMOUR.RIGHT_LEG") {
        return _getLocationByIt(additionalHit.rightLeg, numberOfHit);
    } else if (firstLocation === "ARMOUR.LEFT_LEG") {
        return _getLocationByIt(additionalHit.leftLeg, numberOfHit);
    } else {
        return _getLocationByIt(additionalHit.body, numberOfHit);
    }
}

/**
 * Lookup hit location from array.
 * @param {Array} part
 * @param {number} numberOfHit
 * @returns {string}
 */
function _getLocationByIt(part, numberOfHit) {
    const index = numberOfHit > (part.length - 1) ? part.length - 1 : numberOfHit;
    return part[index];
}


/**
 * Get degrees of success/failure from a target and a roll.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function _getDegree(a, b) {
    return Math.floor(a / 10) - Math.floor(b / 10);
}
/**
 * Replaces all Symbols in the given Formula with their Respective Values
 * The Symbols consist of Attribute Boni and Psyrating
 * @param {*} formula
 * @param {*} rollData
 * @returns {string}
 */
function _replaceSymbols(formula, rollData) {
    let actor = game.actors.get(rollData.ownerId);
    let attributeBoni = actor.attributeBoni;
    if (rollData.psy) {
        formula = formula.replaceAll(/PR/gi, rollData.psy.value);
    }
    for (let boni of attributeBoni) {
        formula = formula.replaceAll(boni.regex, boni.value);
    }
    return formula;
}

/**
 * Add a special weapon modifier value to a roll formula.
 * @param {string} formula
 * @param {string} modifier
 * @param {number} value
 * @returns {string}
 */
function _appendNumberedDiceModifier(formula, modifier, value) {
    let diceRegex = /\d+d\d+/;
    if (!formula.includes(modifier)) {
        let match = formula.match(diceRegex);
        if (match) {
            let dice = match[0];
            dice += `${modifier}${value}`;
            formula = formula.replace(diceRegex, dice);
        }
    }
    return formula;
}

/**
 * Add the "tearing" special weapon modifier to a roll formula.
 * @param {string} formula
 * @returns {string}
 */
function _appendTearing(formula) {
    let diceRegex = /\d+d\d+/;
    if (!formula.match(/dl|kh/gi, formula)) { // Already has drop lowest or keep highest
        let match = formula.match(/\d+/g, formula);
        let numDice = parseInt(match[0]) + 1;
        let faces = parseInt(match[1]);
        let diceTerm = `${numDice}d${faces}dl`;
        formula = formula.replace(diceRegex, diceTerm);
    }
    return formula;
}

/**
 * Post a roll to chat.
 * @param {object} rollData
 */
async function _sendRollToChat(rollData) {
    let speaker = ChatMessage.getSpeaker();
    let chatData = {
        user: game.user.id,
        rollMode: game.settings.get("core", "rollMode"),
        speaker: speaker,
        flags: {
            "dark-heresy.rollData": rollData
        }
    };

    if (speaker.token) {
        rollData.tokenId = speaker.token;
    }

    if (rollData.rollObject) {
        rollData.render = await rollData.rollObject.render();
        chatData.rolls = [rollData.rollObject];
    }

    let html;
    if (rollData.flags.isEvasion) {
        html = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/chat/evasion.hbs", rollData);
    } else {
        html = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/chat/roll.hbs", rollData);
    }
    chatData.content = html;

    if (["gmroll", "blindroll"].includes(chatData.rollMode)) {
        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    } else if (chatData.rollMode === "selfroll") {
        chatData.whisper = [game.user];
    }

    ChatMessage.create(chatData);
}
/**
 * Post rolled damage to chat.
 * @param {object} rollData
 */
export async function sendDamageToChat(rollData) {
    let speaker = ChatMessage.getSpeaker();
    let chatData = {
        user: game.user.id,
        rollMode: game.settings.get("core", "rollMode"),
        speaker: speaker,
        flags: {
            "dark-heresy.rollData": rollData
        }
    };

    if (speaker.token) {
        rollData.tokenId = speaker.token;
    }

    chatData.rolls = rollData.damages.flatMap(r => r.damageRoll);

    const html = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/chat/damage.hbs", rollData);
    chatData.content = html;

    if (["gmroll", "blindroll"].includes(chatData.rollMode)) {
        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    } else if (chatData.rollMode === "selfroll") {
        chatData.whisper = [game.user];
    }

    ChatMessage.create(chatData);
}

/**
 * Post a "you need to reload" message to chat.
 * @param {object} rollData
 */
async function _emptyClipToChat(rollData) {
    let chatData = {
        user: game.user.id,
        content: await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/chat/emptyMag.hbs", rollData),
        flags: {
            "dark-heresy.rollData": rollData
        }
    };
    ChatMessage.create(chatData);
}

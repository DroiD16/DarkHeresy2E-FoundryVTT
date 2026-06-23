import { commonRoll, combatRoll, reportEmptyClip, reportMalfunction } from "./roll.js";
import {
    computeCombatAutomationModifier,
    effectiveAimModifier,
    normalizeTestModifier
} from "./combat-modifiers.js";
import { ammunitionMultiplier, rangeBandModifier, buildTraitsFromQualities, mergeSpecialQualities } from "./weapon-qualities.js";

/**
 * Attach the focus-select behavior used by every roll dialog.
 * Replaces the old inline `<script>$(".wrapper input").focusin(...)</script>`
 * blocks, which no longer execute because DialogV2 injects content via innerHTML.
 * @param {HTMLElement} root  The dialog element containing the form.
 */
function attachFocusSelect(root) {
    for (const input of root.querySelectorAll(".wrapper input")) {
        input.addEventListener("focusin", event => event.currentTarget.select());
    }
}

/**
 * Calculate the weapon automation modifier represented by the current combat
 * dialog controls. This is preview-only; the roll pipeline recalculates from
 * rollData before resolving the test.
 * @param {HTMLElement} root Dialog root.
 * @param {object} rollData Weapon roll data.
 * @returns {number}
 */
function combatAutomationPreview(root, rollData) {
    const aim = root.querySelector("#aim");
    const range = root.querySelector("#range");
    const attackType = root.querySelector("#attackType");
    const rangeBand = range?.value ?? rollData.rangeBand;
    return computeCombatAutomationModifier({
        traits: rollData.weapon.traits,
        aimModifier: effectiveAimModifier(rollData.weapon.traits, aim?.value ?? 0),
        rangeBand,
        rangeMod: rangeBandModifier(rangeBand),
        attackTypeName: attackType?.value ?? rollData.attackType?.name
    }).total;
}

/**
 * Show a generic roll dialog.
 * @param {object} rollData
 */
export async function prepareCommonRoll(rollData) {
    const content = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/dialog/common-roll.hbs", rollData);
    await foundry.applications.api.DialogV2.wait({
        window: { title: rollData.name },
        classes: ["dark-heresy", "dialog"],
        content,
        position: { width: 200 },
        rejectClose: false,
        buttons: [
            {
                action: "roll",
                icon: "fas fa-check",
                label: "BUTTON.ROLL",
                default: true,
                callback: async (event, button) => {
                    const form = button.form;
                    if (rollData.flags?.isEvasion) {
                        const skill = form.querySelector("#selectedSkill");
                        if (skill) {
                            rollData.name = game.i18n.localize(skill.options[skill.selectedIndex].text);
                            rollData.evasions.selected = skill.value;
                        }
                    } else {
                        rollData.name = game.i18n.localize(rollData.name);
                        rollData.target.base = parseInt(form.querySelector("#target").value, 10);
                        // Mirrors old jQuery `html.find("[name=characteristic] :selected").text()`,
                        // which yields "" when the characteristic select is absent (e.g. fear/custom rolls).
                        const characteristic = form.querySelector("[name=characteristic]");
                        rollData.rolledWith = characteristic ? characteristic.options[characteristic.selectedIndex].text : "";
                    }
                    rollData.target.modifier = parseInt(form.querySelector("#modifier").value, 10);
                    rollData.flags.isDamageRoll = false;
                    rollData.flags.isCombatRoll = false;
                    await commonRoll(rollData);
                }
            },
            {
                action: "cancel",
                icon: "fas fa-times",
                label: "BUTTON.CANCEL"
            }
        ],
        render: (event, dialog) => {
            const root = dialog.element;
            attachFocusSelect(root);
            const sel = root.querySelector("select[name=characteristic]");
            const target = root.querySelector("#target");
            if (sel && target) {
                sel.addEventListener("change", () => {
                    target.value = sel.value;
                });
            }
        }
    });
}

/**
 * Show a combat roll dialog.
 * @param {object} rollData
 * @param {DarkHeresyActor} actorRef
 */
export async function prepareCombatRoll(rollData, actorRef) {
    if (rollData.weapon.malfunction) {
        // A jammed/overheated weapon is blocked from firing until the player
        // clears the flag on the weapon sheet.
        reportMalfunction(rollData);
    } else if (rollData.weapon.isRange && rollData.weapon.clip.value <= 0) {
        reportEmptyClip(rollData);
    } else {
        rollData.target.automationModifier = computeCombatAutomationModifier({
            traits: rollData.weapon.traits,
            aimModifier: 0,
            rangeBand: rollData.rangeBand,
            rangeMod: rollData.rangeMod,
            attackTypeName: rollData.attackType?.name
        }).total;
        const content = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/dialog/combat-roll.hbs", rollData);
        await foundry.applications.api.DialogV2.wait({
            window: { title: rollData.name },
            classes: ["dark-heresy", "dialog"],
            content,
            position: { width: 240 },
            rejectClose: false,
            buttons: [
                {
                    action: "roll",
                    icon: "fas fa-check",
                    label: "BUTTON.ROLL",
                    default: true,
                    callback: async (event, button) => {
                        const form = button.form;
                        rollData.name = game.i18n.localize(rollData.name);
                        rollData.target.base = parseInt(form.querySelector("#target")?.value, 10);
                        rollData.target.modifier = normalizeTestModifier(
                            form.querySelector("#modifier")?.value);
                        const range = form.querySelector("#range");
                        if (range) {
                            rollData.rangeBand = range.value;
                            rollData.rangeMod = rangeBandModifier(rollData.rangeBand);
                            rollData.rangeModText = range.options[range.selectedIndex].text;
                        }

                        const attackType = form.querySelector("#attackType");
                        rollData.attackType = {
                            name: attackType?.value,
                            text: attackType?.options[attackType.selectedIndex].text,
                            modifier: 0
                        };

                        const aim = form.querySelector("#aim");
                        rollData.aim = {
                            val: effectiveAimModifier(rollData.weapon.traits, aim?.value),
                            isAiming: aim?.value !== "0",
                            text: aim?.options[aim.selectedIndex].text
                        };

                        let ammo = actorRef.items.get(form.querySelector("#ammo")?.value);

                        // Union the weapon's structured qualities with the
                        // loaded ammunition's (additive, higher value wins) and
                        // rebuild the traits so every downstream read — the
                        // maximal ammunitionMultiplier, the skipAttackRoll check
                        // and combatRoll itself — sees the merged set. With no/
                        // empty ammo, mergeSpecialQualities reproduces the
                        // weapon's own qualities, so the traits are identical and
                        // an ammo-less roll is unchanged. None of the curated ammo
                        // qualities affect the to-hit modifier, so the live
                        // automation preview (refreshAutomation) need not change.
                        rollData.weapon.traits = buildTraitsFromQualities(
                            mergeSpecialQualities(
                                rollData.weapon.specialQualities,
                                ammo?.system.effect.specialQualities
                            )
                        );

                        rollData.weapon.damageFormula = `${form.querySelector("#damageFormula").value.replace(" ", "")}${ammo?.system.effect.damage.modifier ? `+${ammo?.system.effect.damage.modifier}`: ""}`;
                        rollData.weapon.damageType = form.querySelector("#damageType").value;
                        rollData.weapon.damageBonus = parseInt(form.querySelector("#damageBonus").value, 10);
                        rollData.weapon.penetrationFormula = `${form.querySelector("#penetration").value}${ammo?.system.effect.penetration ? `+${ammo?.system.effect.penetration}`: ""}`;
                        rollData.flags.isDamageRoll = false;
                        rollData.flags.isCombatRoll = true;

                        // Maximal (Free Action toggle): fire on the strongest
                        // setting for +1d10 damage, +2 penetration and +10 m
                        // range (the range bonus matters for the Spray cone, which
                        // draws to weapon.range). The x3 ammo cost is applied in
                        // _updateRangedAmmo via rollData.maximal.
                        if (form.querySelector("#maximal")?.checked) {
                            const minimumCharge = ammunitionMultiplier(rollData.weapon.traits, true);
                            if (rollData.weapon.clip.max > 0 && rollData.weapon.clip.value < minimumCharge) {
                                await reportEmptyClip(rollData);
                                return;
                            }
                            rollData.weapon.damageFormula = `${rollData.weapon.damageFormula}+1d10`;
                            rollData.weapon.penetrationFormula = `${rollData.weapon.penetrationFormula}+2`;
                            rollData.weapon.range = (rollData.weapon.range ?? 0) + 10;
                            rollData.maximal = true;
                        }

                        if (rollData.weapon.traits.skipAttackRoll) {
                            rollData.attackType.name = "standard";
                        }

                        await combatRoll(rollData);
                    }
                },
                {
                    action: "cancel",
                    icon: "fas fa-times",
                    label: "BUTTON.CANCEL"
                }
            ],
            render: (event, dialog) => {
                const root = dialog.element;
                attachFocusSelect(root);
                const automation = root.querySelector("#automationModifier");
                const refreshAutomation = () => {
                    if (automation) automation.value = combatAutomationPreview(root, rollData);
                };
                for (const control of root.querySelectorAll("#aim, #range, #attackType")) {
                    control.addEventListener("change", refreshAutomation);
                }
                refreshAutomation();
            }
        });
    }
}

/**
 * Show a psychic power roll dialog.
 * @param {object} rollData
 */
export async function preparePsychicPowerRoll(rollData) {
    const content = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/dialog/psychic-power-roll.hbs", rollData);
    await foundry.applications.api.DialogV2.wait({
        window: { title: rollData.name },
        classes: ["dark-heresy", "dialog"],
        content,
        position: { width: 200 },
        rejectClose: false,
        buttons: [
            {
                action: "roll",
                icon: "fas fa-check",
                label: "BUTTON.ROLL",
                default: true,
                callback: async (event, button) => {
                    const form = button.form;
                    rollData.name = game.i18n.localize(rollData.name);
                    rollData.target.base = parseInt(form.querySelector("#target")?.value, 10);
                    rollData.target.modifier = parseInt(form.querySelector("#modifier")?.value, 10);
                    rollData.psy.value = parseInt(form.querySelector("#psy").value, 10);
                    rollData.psy.warpConduit = form.querySelector("#warpConduit").checked;
                    rollData.weapon.damageFormula = form.querySelector("#damageFormula").value;
                    rollData.weapon.damageType = form.querySelector("#damageType").value;
                    rollData.weapon.damageBonus = parseInt(form.querySelector("#damageBonus").value, 10);
                    rollData.weapon.penetrationFormula = form.querySelector("#penetration").value;
                    rollData.weapon.rateOfFire = { burst: rollData.psy.value, full: rollData.psy.value };
                    const attackType = form.querySelector("#attackType");
                    rollData.attackType.name = attackType.value;
                    rollData.attackType.text = attackType.options[attackType.selectedIndex].text;
                    rollData.psy.useModifier = true;
                    rollData.flags.isDamageRoll = false;
                    rollData.flags.isCombatRoll = true;
                    await combatRoll(rollData);
                }
            },
            {
                action: "cancel",
                icon: "fas fa-times",
                label: "BUTTON.CANCEL"
            }
        ],
        render: (event, dialog) => {
            const root = dialog.element;
            attachFocusSelect(root);
            const slider = root.querySelector("#rating");
            const output = root.querySelector("#psy");
            if (slider && output) {
                slider.addEventListener("input", event => {
                    output.value = event.currentTarget.value;
                });
            }
        }
    });
}

import { commonRoll, combatRoll, reportEmptyClip } from "./roll.js";

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
 * Show a generic roll dialog.
 * @param {object} rollData
 */
export async function prepareCommonRoll(rollData) {
    const content = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/dialog/common-roll.hbs", rollData);
    await foundry.applications.api.DialogV2.wait({
        window: { title: rollData.name },
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
    if (rollData.weapon.isRange && rollData.weapon.clip.value <= 0) {
        reportEmptyClip(rollData);
    } else {
        const content = await foundry.applications.handlebars.renderTemplate("systems/dark-heresy/template/dialog/combat-roll.hbs", rollData);
        await foundry.applications.api.DialogV2.wait({
            window: { title: rollData.name },
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
                        const range = form.querySelector("#range");
                        if (range) {
                            rollData.rangeMod = parseInt(range.value, 10);
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
                            val: parseInt(aim?.value, 10),
                            isAiming: aim?.value !== "0",
                            text: aim?.options[aim.selectedIndex].text
                        };

                        if (rollData.weapon.traits.inaccurate) {
                            rollData.aim.val=0;
                        } else if (rollData.weapon.traits.accurate && rollData.aim.isAiming) {
                            rollData.aim.val += 10;
                        }

                        let ammo = actorRef.items.get(form.querySelector("#ammo")?.value);

                        rollData.weapon.damageFormula = `${form.querySelector("#damageFormula").value.replace(" ", "")}${ammo?.system.effect.damage.modifier ? `+${ammo?.system.effect.damage.modifier}`: ""}`;
                        rollData.weapon.damageType = form.querySelector("#damageType").value;
                        rollData.weapon.damageBonus = parseInt(form.querySelector("#damageBonus").value, 10);
                        rollData.weapon.penetrationFormula = `${form.querySelector("#penetration").value}${ammo?.system.effect.penetration ? `+${ammo?.system.effect.penetration}`: ""}`;
                        rollData.flags.isDamageRoll = false;
                        rollData.flags.isCombatRoll = true;

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
                attachFocusSelect(dialog.element);
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

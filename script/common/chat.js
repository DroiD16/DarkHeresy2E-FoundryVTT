import { commonRoll, combatRoll, damageRoll } from "./roll.js";
import { prepareCommonRoll } from "./dialog.js";
import DarkHeresyUtil from "./util.js";
import { resolveRollActor, resolveRollItem } from "./roll-documents.js";
import { reloadWeapon } from "./ammunition-reload.js";


/**
 * Listeners for Chatmessages
 * @param {HTMLElement} html
 */
export function chatListeners(html) {
    if (!(html instanceof HTMLElement)) return;
    html.querySelectorAll(".invoke-test")?.forEach(button => button.addEventListener("click", event => onTestClick(event)));
    html.querySelectorAll(".invoke-damage")?.forEach(button => button.addEventListener("click", event => onDamageClick(event)));
    html.querySelectorAll(".reload-Weapon")?.forEach(button => button.addEventListener("click", event => onReloadClick(event)));
    html.querySelectorAll(".roll-phenomena")?.forEach(button => button.addEventListener("click", event => onRollPhenomenaClick(event)));
    html.querySelectorAll(".dark-heresy.chat.roll>.background.border")?.forEach(button => button.addEventListener("dblclick", event => onChatRollClick(event)));
}

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 *
 * @returns {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function(html, options) {
    let canApply = li => {
        const message = game.messages.get(li.dataset.messageId);
        return message.getRollData()?.flags.isDamageRoll
            && message.isContentVisible
            && canvas.tokens.controlled.length;
    };
    options.unshift(
        {
            name: game.i18n.localize("CHAT.CONTEXT.APPLY_DAMAGE"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canApply,
            callback: li => applyChatCardDamage(li)
        }
    );

    let canReroll = li => {
        const message = game.messages.get(li.dataset.messageId);
        let actor = resolveRollActor(message.getRollData());
        return message.isRoll
            && !message.getRollData()?.flags.isDamageRoll
            && message.isContentVisible
            && actor?.fate.value > 0;
    };

    options.unshift(
        {
            name: game.i18n.localize("CHAT.CONTEXT.REROLL"),
            icon: '<i class="fa-solid fa-repeat"></i>',
            condition: canReroll,
            callback: li => {
                const message = game.messages.get(li.dataset.messageId);
                rerollTest(message.getRollData());
            }
        }
    );
    return options;
};

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} roll    The chat entry which contains the roll data
 * @param {number} multiplier   A damage multiplier to apply to the rolled damage.
 * @returns {Promise}
 */
function applyChatCardDamage(roll, multiplier) {
    // Get the damage data, get them as arrays in case of multiple hits
    const amount = roll.querySelectorAll(".damage-total");
    const location = roll.querySelectorAll(".damage-location");
    const penetration = roll.querySelectorAll(".damage-penetration");
    const type = roll.querySelectorAll(".damage-type");
    const righteousFury = roll.querySelectorAll(".damage-righteous-fury");

    // Put the data from different hits together
    const damages = [];
    for (let i = 0; i < amount.length; i++) {
        // The NodeLists can differ in length (e.g. only hits with righteous fury
        // emit a .damage-righteous-fury element), so guard each indexed access —
        // the prior jQuery `$(x).text()`/`.data()` returned ""/undefined for a
        // missing element rather than throwing.
        damages.push({
            amount: amount[i]?.textContent ?? "",
            location: location[i]?.dataset.location,
            penetration: penetration[i]?.textContent ?? "",
            type: type[i]?.textContent ?? "",
            righteousFury: righteousFury[i]?.textContent ?? ""
        });
    }

    // Apply to any selected actors
    return Promise.all(canvas.tokens.controlled.map(t => {
        const a = t.actor;
        return a.applyDamage(damages);
    }));
}

/**
 * Rerolls the Test using the same Data as the initial Roll while reducing an actors fate
 * @param {object} rollData
 * @returns {Promise}
 */
function rerollTest(rollData) {
    let actor = resolveRollActor(rollData);
    actor.update({ "system.fate.value": actor.fate.value -1 });
    delete rollData.damages; // Reset so no old data is shown on failure

    rollData.flags.isReRoll = true;
    if (rollData.flags.isCombatRoll) {
    // All the regexes in this are broken once retrieved from the chatmessage
    // No idea why this happens so we need to fetch them again so the roll works correctly
        rollData.attributeBoni = actor.attributeBoni;
        return combatRoll(rollData);
    } else {
        return commonRoll(rollData);
    }
}

/**
 * Rolls a Test for the Selected Actor
 * @param {Event} ev
 */
function onTestClick(ev) {
    let actor = game.macro.getActor();
    let id = ev.currentTarget.closest(".message")?.dataset.messageId;
    let msg = game.messages.get(id);
    let rollData = msg.getRollData();

    if (!actor) {
        ui.notifications.warn(`${game.i18n.localize("NOTIFICATION.MACRO_ACTOR_NOT_FOUND")}`);
        return;
    }
    let evasions = {
        dodge: DarkHeresyUtil.createSkillRollData(actor, "dodge"),
        parry: DarkHeresyUtil.createSkillRollData(actor, "parry"),
        deny: DarkHeresyUtil.createCharacteristicRollData(actor, "willpower"),
        selected: "dodge"
    };
    rollData.evasions = evasions;
    rollData.target.modifier = 0;
    rollData.flags.isEvasion = true;
    rollData.flags.isAttack = false;
    rollData.flags.isDamageRoll = false;
    rollData.flags.isCombatRoll = false;
    if (rollData.psy) rollData.psy.display = false;
    rollData.name = game.i18n.localize("DIALOG.EVASION");
    prepareCommonRoll(rollData);
}

/**
 * Rolls an Evasion chat for the currently selected character from the chatcard
 * @param {Event} ev
 * @returns {Promise}
 */
function onDamageClick(ev) {
    let id = ev.currentTarget.closest(".message")?.dataset.messageId;
    let msg = game.messages.get(id);
    let rollData = msg.getRollData();
    rollData.flags.isEvasion = false;
    rollData.flags.isCombatRoll = false;
    rollData.flags.isDamageRoll = true;
    return damageRoll(rollData);
}

/**
 * Reload the associated empty weapon, consuming one linked ammunition magazine
 * when available.
 * @param {Event} ev
 */
async function onReloadClick(ev) {
    let id = ev.currentTarget.closest(".message")?.dataset.messageId;
    let msg = game.messages.get(id);
    let rollData = msg.getRollData();
    const weapon = resolveRollItem(rollData);
    await reloadWeapon(weapon, {
        warn: reloadWithoutAmmunitionToChat,
        remind: reloadManualReminderToChat
    });
}

/**
 * Post a warning that a weapon was reloaded despite an empty ammunition stack.
 * @param {Item} weapon Reloaded weapon.
 * @param {Item} ammunition Depleted ammunition.
 * @returns {Promise<ChatMessage>}
 */
async function reloadWithoutAmmunitionToChat(weapon, ammunition) {
    const content = await foundry.applications.handlebars.renderTemplate(
        "systems/dark-heresy/template/chat/reload-warning.hbs",
        { weapon, ammunition }
    );
    return ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: weapon.actor }),
        content
    });
}

/**
 * Post a reminder that a weapon with several linked ammunition types was reloaded
 * without auto-subtracting any magazine — the player must subtract the rounds for
 * whichever ammo they actually loaded.
 * @param {Item} weapon Reloaded weapon.
 * @returns {Promise<ChatMessage>}
 */
async function reloadManualReminderToChat(weapon) {
    const content = await foundry.applications.handlebars.renderTemplate(
        "systems/dark-heresy/template/chat/reload-manual.hbs",
        { weapon }
    );
    return ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: weapon.actor }),
        content
    });
}

/**
 * Roll the separate Psychic Phenomena test (1d100 on Table 6-2) from the chat
 * card. Opens a small dialog prefilled with the suggested modifier (computed in
 * roll.js) so the player can adjust it, then posts the modified d100 to chat.
 * The numeric result is all this produces: the player looks up Table 6-2 (and
 * Table 6-3 on a 75+ result) themselves.
 * @param {Event} ev
 * @returns {Promise}
 */
async function onRollPhenomenaClick(ev) {
    const suggested = parseInt(ev.currentTarget.dataset.phenomenaMod, 10) || 0;
    const title = game.i18n.localize("CHAT.ROLL_PHENOMENA_TITLE");
    const label = game.i18n.localize("DIALOG.MODIFIER");
    // Mirror the system's standard roll dialog (a .background.border box with a
    // grey <h1> header and a .wrapper label+input row); modifier-only, no target.
    const content = `<div class="dark-heresy dialog"><div class="flex row wrap background border" style="flex-basis: 100%;margin-bottom: 5px"><h1>${title}</h1><div class="wrapper"><label>${label}</label><input id="phenomenaMod" type="number" value="${suggested}" data-dtype="Number" /></div></div></div>`;
    await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("CHAT.ROLL_PHENOMENA_TITLE") },
        classes: ["dark-heresy", "dialog"],
        content,
        position: { width: "auto" },
        rejectClose: false,
        buttons: [
            {
                action: "roll",
                icon: "fas fa-check",
                label: "BUTTON.ROLL",
                default: true,
                callback: async (event, button) => {
                    const mod = parseInt(button.form.querySelector("#phenomenaMod").value, 10) || 0;
                    // Build the formula with an explicit sign so an edited
                    // negative modifier still parses cleanly.
                    const formula = `1d100 ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`;
                    const roll = new Roll(formula);
                    await roll.evaluate();
                    // Render a system-styled card (matching template/chat/roll.hbs)
                    // instead of Foundry's default roll message, mirroring _sendRollToChat.
                    const content = await foundry.applications.handlebars.renderTemplate(
                        "systems/dark-heresy/template/chat/phenomena.hbs",
                        { title: game.i18n.localize("CHAT.ROLL_PHENOMENA_TITLE"), total: roll.total, modifier: mod }
                    );
                    const chatData = {
                        user: game.user.id,
                        rollMode: game.settings.get("core", "rollMode"),
                        speaker: ChatMessage.getSpeaker(),
                        content,
                        rolls: [roll]
                    };
                    if (["gmroll", "blindroll"].includes(chatData.rollMode)) {
                        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
                    } else if (chatData.rollMode === "selfroll") {
                        chatData.whisper = [game.user];
                    }
                    await ChatMessage.create(chatData);
                }
            },
            {
                action: "cancel",
                icon: "fas fa-times",
                label: "BUTTON.CANCEL"
            }
        ]
    });
}

/**
 * Show/hide dice rolls when a chat message is clicked.
 * @param {Event} event
 */
function onChatRollClick(event) {
    event.preventDefault();
    const roll = event.currentTarget.parentElement;
    const tip = roll.querySelector(".dice-rolls");
    if (!tip) return;
    const hidden = getComputedStyle(tip).display === "none";
    tip.style.display = hidden ? "block" : "none";
}

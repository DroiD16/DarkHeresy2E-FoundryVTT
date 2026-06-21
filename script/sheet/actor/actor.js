import { prepareCommonRoll, prepareCombatRoll, preparePsychicPowerRoll } from "../../common/dialog.js";
import DarkHeresyUtil from "../../common/util.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Base Actor sheet for the Dark Heresy system, built on ApplicationV2.
 * Per-type sheets (acolyte/npc) extend this and declare their `classes` + `PARTS`.
 * @extends {ActorSheetV2}
 */
export class DarkHeresySheet extends HandlebarsApplicationMixin(ActorSheetV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "actor"],
        position: { width: 700, height: 881 },
        window: { resizable: true },
        form: { submitOnChange: true },
        actions: {
            customRoll: DarkHeresySheet.#onCustomRoll
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Source `system` from the live prepared model (not toObject(false), which
        // drops the DataModel-derived keys the sheet renders).
        context.actor = this.actor;
        context.system = this.actor.system;
        context.items = this.constructItemLists();
        context.enrichment = await this._enrichment();
        context.effects = this.prepareActiveEffectCategories();
        context.owner = this.actor.isOwner;
        context.editable = this.isEditable;
        return context;
    }

    /** @inheritDoc */
    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        // Non-GM users with only limited permission get the reduced sheet.
        if (!game.user.isGM && this.actor.limited && parts.form) {
            parts.form = {
                ...parts.form,
                template: "systems/dark-heresy/template/sheet/actor/limited-sheet.hbs"
            };
        }
        return parts;
    }

    /**
     * Enrich the actor's HTML notes for display.
     * @returns {Promise<object>} The expanded enrichment data.
     */
    async _enrichment() {
        const enrichment = {};
        const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
        if (this.actor.type !== "npc") {
            enrichment["system.bio.notes"] = await TextEditorImpl.enrichHTML(this.actor.system.bio.notes, { async: true });
        } else {
            enrichment["system.notes"] = await TextEditorImpl.enrichHTML(this.actor.system.notes, { async: true });
        }
        return foundry.utils.expandObject(enrichment);
    }

    /** @inheritDoc */
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        // Put the ROLL button directly in the title bar (like V1) rather than in
        // the ApplicationV2 controls dropdown. Injected before the close button;
        // its `data-action` dispatches to the customRoll action handler.
        if (this.actor.isOwner) {
            const label = game.i18n.localize("BUTTON.ROLL");
            const button = `<button type="button" class="header-control icon fa-solid fa-dice"
                data-action="customRoll" data-tooltip="${label}" aria-label="${label}"></button>`;
            this.window.close.insertAdjacentHTML("beforebegin", button);
        }
        return frame;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        const element = this.element;
        // Select an input's contents on focus (replaces the V1 jQuery focusin).
        element.addEventListener("focusin", event => {
            if (event.target.matches("input, textarea")) event.target.select();
        });
        // Delegated handlers on the persistent frame (replaces the V1 jQuery
        // class bindings); robust across part re-renders, bound once.
        element.addEventListener("click", this.#onClick.bind(this));
        element.addEventListener("change", this.#onChange.bind(this));
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this._activateTabs();
    }

    /**
     * Re-apply the active tab after each render (parts re-render without the
     * `active` class; also preserves the user's tab across submitOnChange).
     * @protected
     */
    _activateTabs() {
        for (const nav of this.element.querySelectorAll(".tabs[data-group]")) {
            const group = nav.dataset.group;
            let active = this.tabGroups[group];
            const hasActive = active
                && this.element.querySelector(`.tabs [data-group="${group}"][data-tab="${active}"]`);
            if (!hasActive) {
                active = this.element.querySelector(`.tabs [data-group="${group}"][data-tab]`)?.dataset.tab;
            }
            if (active) this.changeTab(active, group, { force: true, updatePosition: false });
        }
    }

    /**
     * Delegated click dispatcher for the class-based sheet controls.
     * @param {PointerEvent} event  The originating click event.
     * @returns {*} The matched handler's result, if any.
     */
    #onClick(event) {
        const target = event.target;
        let el;
        // Order matters: closest() walks UP the tree, so the small leaf controls
        // are matched before the broad `.item-edit` name/image area (which wraps
        // a large region and could otherwise swallow a nested control).
        if ((el = target.closest(".item-create"))) return this._onItemCreate(el);
        if ((el = target.closest(".item-delete"))) return this._onItemDelete(el);
        if ((el = target.closest(".ammo-unlink"))) return this._onAmmoUnlink(el);
        if ((el = target.closest(".roll-characteristic"))) return this._prepareRollCharacteristic(el);
        if ((el = target.closest(".roll-skill"))) return this._prepareRollSkill(el);
        if ((el = target.closest(".roll-speciality"))) return this._prepareRollSpeciality(el);
        if (target.closest(".roll-insanity")) return this._prepareRollInsanity();
        if (target.closest(".roll-corruption")) return this._prepareRollCorruption();
        if ((el = target.closest(".roll-weapon"))) return this._prepareRollWeapon(el);
        if ((el = target.closest(".roll-psychic-power"))) return this._prepareRollPsychicPower(el);
        if ((el = target.closest(".condition-toggle"))) return this._onConditionToggle(el);
        if ((el = target.closest(".item-edit"))) return this._onItemEdit(el);
    }

    /**
     * Delegated change dispatcher for cross-document item edits made from the
     * actor sheet (these inputs are unnamed, so they bypass the actor form).
     * @param {Event} event  The originating change event.
     * @returns {*} The matched handler's result, if any.
     */
    #onChange(event) {
        const target = event.target;
        if (target.classList.contains("item-cost")) {
            event.stopPropagation();
            return this._onItemCostChange(target);
        }
        if (target.classList.contains("item-starter")) {
            event.stopPropagation();
            return this._onItemStarterChange(target);
        }
    }

    /**
     * Open the generic roll dialog (header control).
     * @this {DarkHeresySheet}
     * @returns {Promise<void>}
     */
    static #onCustomRoll() {
        return this._prepareCustomRoll();
    }

    _onItemCreate(target) {
        const header = target.dataset;
        const data = {
            name: `New ${game.i18n.localize(`TYPES.Item.${header.type.toLowerCase()}`)}`,
            type: header.type
        };
        return this.actor.createEmbeddedDocuments("Item", [data], { renderSheet: true });
    }

    _onItemEdit(target) {
        const item = this.actor.items.get(target.closest(".item").dataset.itemId);
        return item?.sheet.render(true);
    }

    _onItemDelete(target) {
        const itemId = target.closest(".item").dataset.itemId;
        return this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }

    _onAmmoUnlink(target) {
        const ammoId = target.closest(".linked-item").dataset.ammoId;
        const weaponId = target.closest(".item").dataset.itemId;

        const newAmmos = this.actor.items.get(weaponId).system.ammo.filter(ammo => ammo !== ammoId);
        this.actor.items.get(weaponId).update({ "system.ammo": newAmmos });
        this.actor.items.get(ammoId).update({ "system.weaponId": "" });
    }

    async _prepareCustomRoll() {
        const rollData = {
            name: "DIALOG.CUSTOM_ROLL",
            baseTarget: 50,
            modifier: 0,
            ownerId: this.actor.id
        };
        await prepareCommonRoll(rollData);
    }

    async _prepareRollCharacteristic(target) {
        const characteristicName = target.dataset.characteristic;
        await prepareCommonRoll(
            DarkHeresyUtil.createCharacteristicRollData(this.actor, characteristicName)
        );
    }

    async _prepareRollSkill(target) {
        const skillName = target.dataset.skill;
        await prepareCommonRoll(
            DarkHeresyUtil.createSkillRollData(this.actor, skillName)
        );
    }

    async _prepareRollSpeciality(target) {
        const skillName = target.closest(".item").dataset.skill;
        const specialityName = target.dataset.speciality;
        await prepareCommonRoll(
            DarkHeresyUtil.createSpecialtyRollData(this.actor, skillName, specialityName)
        );
    }

    async _prepareRollInsanity() {
        await prepareCommonRoll(
            DarkHeresyUtil.createFearTestRolldata(this.actor)
        );
    }

    async _prepareRollCorruption() {
        await prepareCommonRoll(
            DarkHeresyUtil.createMalignancyTestRolldata(this.actor)
        );
    }

    async _prepareRollWeapon(target) {
        const weapon = this.actor.items.get(target.closest(".item").dataset.itemId);
        await prepareCombatRoll(
            DarkHeresyUtil.createWeaponRollData(this.actor, weapon),
            this.actor
        );
    }

    async _prepareRollPsychicPower(target) {
        const psychicPower = this.actor.items.get(target.closest(".item").dataset.itemId);
        await preparePsychicPowerRoll(
            DarkHeresyUtil.createPsychicRollData(this.actor, psychicPower)
        );
    }

    _onConditionToggle(target) {
        const key = target.closest(".condition").dataset.key;
        if (this.actor.hasCondition(key)) {
            this.actor.removeCondition(key);
        } else {
            this.actor.addCondition(key);
        }
    }

    _onItemCostChange(target) {
        const item = this.actor.items.get(target.closest(".item").dataset.itemId);
        item.update({ "system.cost": target.value });
    }

    _onItemStarterChange(target) {
        const item = this.actor.items.get(target.closest(".item").dataset.itemId);
        item.update({ "system.starter": target.checked });
    }

    constructItemLists() {
        let items = {};
        let itemTypes = this.actor.itemTypes;
        items.mentalDisorders = itemTypes.mentalDisorder;
        items.malignancies = itemTypes.malignancy;
        items.mutations = itemTypes.mutation;
        if (this.actor.type === "npc") {
            items.abilities = itemTypes.talent
                .concat(itemTypes.trait)
                .concat(itemTypes.specialAbility);
        }
        items.talents = itemTypes.talent;
        items.traits = itemTypes.trait;
        items.specialAbilities = itemTypes.specialAbility;
        items.aptitudes = itemTypes.aptitude;

        items.psychicPowers = itemTypes.psychicPower;

        items.criticalInjuries = itemTypes.criticalInjury;

        items.gear = itemTypes.gear;
        items.drugs = itemTypes.drug;
        items.tools = itemTypes.tool;
        items.cybernetics = itemTypes.cybernetic;

        items.armour = itemTypes.armour;
        items.forceFields = itemTypes.forceField;

        items.weapons = itemTypes.weapon;
        items.weaponMods = itemTypes.weaponModification;
        items.ammunitions = itemTypes.ammunition;
        this._sortItemLists(items);

        return items;
    }

    _sortItemLists(items) {
        for (let list in items) {
            if (Array.isArray(items[list])) items[list] = items[list].sort((a, b) => a.sort - b.sort);
            else if (typeof items[list] == "object") _sortItemLists(items[list]);
        }
    }

    /**
     *  Prepare the data structure for Active Effects which are currently embedded in an Actor or Item.
     * @returns {object}                   Data for rendering
     */
    prepareActiveEffectCategories() {
        // Define effect header categories, populated via the shared categorizer
        // used by item sheets too; conditions are filtered out and appended here.
        const categories = DarkHeresyUtil.categorizeEffects(
            Array.from(this.actor.allApplicableEffects()).filter(e => !this._isCondition(e))
        );

        categories.conditions = CONFIG.statusEffects.map(i => {
            return {
                name: i.name,
                key: i.id,
                img: i.img,
                existing: this.actor.hasCondition(i.id)
            };
        });

        return categories;
    }

    _isCondition(effect) {
        return CONFIG.statusEffects.map(i => i.id).includes(Array.from(effect.statuses)[0]);
    }

}

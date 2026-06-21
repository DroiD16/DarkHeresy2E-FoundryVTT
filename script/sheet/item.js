const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Base Item sheet for the Dark Heresy system, built on ApplicationV2.
 * Per-type sheets extend this and only declare their `classes`, `PARTS`, and
 * (where it differs) `position`.
 * @extends {ItemSheetV2}
 */
export class DarkHeresyItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet"],
        position: { width: 500, height: 369 },
        window: { resizable: true },
        form: { submitOnChange: true },
        actions: {
            postItem: DarkHeresyItemSheet.#onPostItem,
            // Effect-control action names match the data-action values used in
            // BOTH effect-tab.hbs and effect-part.hbs (the two effect partials
            // item sheets render), left at their original names so neither
            // shared partial needs to change.
            create: DarkHeresyItemSheet.#onEffectCreate,
            edit: DarkHeresyItemSheet.#onEffectEdit,
            delete: DarkHeresyItemSheet.#onEffectDelete,
            toggle: DarkHeresyItemSheet.#onEffectToggle
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Source `system` from the live prepared model, not toObject(false),
        // which schema-serializes and drops DataModel-derived keys.
        context.item = this.item;
        context.system = this.item.system;
        context.enrichment = await this._handleEnrichment();
        context.effects = this.item.effects;
        context.owner = this.item.isOwner;
        context.editable = this.isEditable;
        return context;
    }

    /**
     * Enrich the item's HTML description and effect fields for display.
     * @returns {Promise<object>} The expanded enrichment data.
     */
    async _handleEnrichment() {
        const enrichment = {};
        const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
        enrichment["system.description"] = await TextEditorImpl.enrichHTML(this.item.system.description, { async: true });
        enrichment["system.effect"] = await TextEditorImpl.enrichHTML(this.item.system.effect, { async: true });
        return foundry.utils.expandObject(enrichment);
    }

    /** @inheritDoc */
    _getHeaderControls() {
        return [
            ...super._getHeaderControls(),
            {
                icon: "fas fa-comment",
                label: "BUTTON.POST_ITEM",
                action: "postItem"
            }
        ];
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // Select an input's contents when it gains focus (replaces the V1
        // jQuery `_onFocusIn`). focusin bubbles, so a single delegated listener
        // on the persistent frame covers inputs re-rendered in parts.
        this.element.addEventListener("focusin", event => {
            if (event.target.matches("input, textarea")) event.target.select();
        });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this._activateTabs();
    }

    /**
     * Re-apply the active tab after each render. Parts re-render without the
     * `active` class, so the persisted (or first available) tab is re-activated
     * here, which also preserves the user's tab across `submitOnChange` renders.
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
     * Post the item to chat.
     * @this {DarkHeresyItemSheet}
     * @returns {Promise<ChatMessage|void>} The created chat message, if any.
     */
    static #onPostItem() {
        return this.item.sendToChat();
    }

    /**
     * Create a new Active Effect on the item.
     * @this {DarkHeresyItemSheet}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The control that defined the action.
     * @returns {Promise<ActiveEffect[]>} The created effect(s).
     */
    static #onEffectCreate(event, target) {
        const li = target.closest("[data-effect-type]");
        return this.item.createEmbeddedDocuments("ActiveEffect", [
            {
                name: game.i18n.format("DOCUMENT.New", {
                    type: game.i18n.localize("DOCUMENT.ActiveEffect")
                }),
                icon: "icons/svg/aura.svg",
                origin: this.item.uuid,
                "duration.rounds": li?.dataset.effectType === "temporary" ? 1 : undefined,
                disabled: li?.dataset.effectType === "inactive"
            }
        ]);
    }

    /**
     * Render the sheet of the Active Effect identified by the clicked control.
     * @this {DarkHeresyItemSheet}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The control that defined the action.
     * @returns {Application|undefined} The rendered effect sheet, if found.
     */
    static #onEffectEdit(event, target) {
        return this.#getEffect(target)?.sheet.render(true);
    }

    /**
     * Delete the Active Effect identified by the clicked control.
     * @this {DarkHeresyItemSheet}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The control that defined the action.
     * @returns {Promise<ActiveEffect>|undefined} The deletion, if an effect was found.
     */
    static #onEffectDelete(event, target) {
        return this.#getEffect(target)?.delete();
    }

    /**
     * Toggle the disabled state of the Active Effect identified by the control.
     * @this {DarkHeresyItemSheet}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The control that defined the action.
     * @returns {Promise<ActiveEffect>|undefined} The update, if an effect was found.
     */
    static #onEffectToggle(event, target) {
        const effect = this.#getEffect(target);
        return effect?.update({ disabled: !effect.disabled });
    }

    /**
     * Resolve the Active Effect owning the clicked control.
     * @this {DarkHeresyItemSheet}
     * @param {HTMLElement} target  The control that defined the action.
     * @returns {ActiveEffect|undefined} The owning effect, if any.
     */
    static #getEffect(target) {
        const li = target.closest("[data-effect-id]");
        return li ? this.item.effects.get(li.dataset.effectId) : undefined;
    }
}

import DarkHeresyUtil from "../common/util.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Base Item sheet for the Dark Heresy system, built on ApplicationV2.
 * Per-type sheets extend this and only declare their `classes`, `PARTS`, and
 * (where it differs) `position`.
 * @extends {ItemSheetV2}
 */
export class DarkHeresyItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    /** Opt-in configuration for the shared special-quality chip editor. */
    static QUALITY_EDITOR = null;

    // Serialize quality writes so rapid UI events always read the result of the
    // preceding asynchronous item update instead of a stale array snapshot.
    #qualityMutations = Promise.resolve();

    /** @inheritDoc */
    static get DEFAULT_OPTIONS() {
        const isRussian = game.i18n.lang === "ru";
        return {
            classes: ["dark-heresy", "sheet", ...(isRussian ? ["lang-ru"] : [])],
            position: { width: isRussian ? 600 : 500, height: 369 },
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
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Source `system` from the live prepared model, not toObject(false),
        // which schema-serializes and drops DataModel-derived keys.
        context.item = this.item;
        context.system = this.item.system;
        context.enrichment = await this._handleEnrichment();
        context.effects = DarkHeresyUtil.categorizeEffects(this.item.effects);
        context.owner = this.item.isOwner;
        context.editable = this.isEditable;
        this.#prepareQualityEditorContext(context);
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
        this.#activateQualityEditor();
    }

    /**
     * Populate the shared chip-editor context for sheets which opt into it.
     * @param {object} context The render context to extend.
     */
    #prepareQualityEditorContext(context) {
        const editor = this.constructor.QUALITY_EDITOR;
        if (!editor) return;

        const cfg = game.darkHeresy.config[editor.config ?? "weaponQualities"];
        const current = foundry.utils.getProperty(this.item, editor.systemPath) ?? [];
        context.qualityChips = current.map(quality => {
            const entry = cfg[quality.key];
            return {
                key: quality.key,
                label: entry ? game.i18n.localize(entry.labelKey) : quality.key,
                desc: entry?.descKey ? game.i18n.localize(entry.descKey) : "",
                hasValue: !!entry?.hasValue,
                value: quality.value ?? entry?.default ?? null
            };
        });

        const present = new Set(current.map(quality => quality.key));
        const availableKeys = editor.curatedKeys ?? Object.keys(cfg);
        context.qualityOptions = availableKeys
            .filter(key => cfg[key] && !present.has(key))
            .map(key => ({ key, label: game.i18n.localize(cfg[key].labelKey) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    /** Bind the delegated controls for the shared special-quality chip editor. */
    #activateQualityEditor() {
        if (!this.constructor.QUALITY_EDITOR) return;
        const element = this.element;

        element.addEventListener("change", event => {
            const select = event.target.closest(".add-quality-select");
            if (!select || !this.isEditable) return;
            const key = select.value;
            select.value = "";
            if (!key) return;
            const cfg = game.darkHeresy.config[this.constructor.QUALITY_EDITOR.config ?? "weaponQualities"];
            const entry = cfg[key];
            if (!entry) return;
            this.#mutateQualities(current => {
                if (current.some(quality => quality.key === key)) return null;
                current.push({ key, value: entry.hasValue ? entry.default ?? null : null });
                return current;
            });
        });

        element.addEventListener("change", event => {
            const input = event.target.closest(".quality-value-input");
            if (!input || !this.isEditable) return;
            const key = input.dataset.key;
            const raw = input.value.trim();
            const parsed = raw === "" ? null : parseInt(raw, 10);
            const value = Number.isNaN(parsed) ? null : Math.max(0, parsed);
            this.#mutateQualities(current => {
                const entry = current.find(quality => quality.key === key);
                if (!entry) return null;
                entry.value = value;
                return current;
            });
        });

        element.addEventListener("click", event => {
            const button = event.target.closest(".remove-quality");
            if (!button || !this.isEditable) return;
            event.preventDefault();
            const key = button.dataset.key;
            this.#mutateQualities(current => {
                const next = current.filter(quality => quality.key !== key);
                return next.length === current.length ? null : next;
            });
        });
    }

    /**
     * Apply one serialized mutation to the configured special-quality array.
     * @param {(current: {key: string, value: (number|null)}[]) => (object[]|null)} mutator
     * @returns {Promise<void>}
     */
    #mutateQualities(mutator) {
        const systemPath = this.constructor.QUALITY_EDITOR.systemPath;
        this.#qualityMutations = this.#qualityMutations.then(async () => {
            const qualities = foundry.utils.getProperty(this.item, systemPath) ?? [];
            const current = qualities.map(quality => ({ key: quality.key, value: quality.value }));
            const next = mutator(current);
            if (next) await this.item.update({ [systemPath]: next });
        }).catch(err => console.error("dark-heresy | special-quality update failed:", err));
        return this.#qualityMutations;
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
                img: "icons/svg/aura.svg",
                origin: this.item.uuid,
                transfer: true,
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
    #getEffect(target) {
        const li = target.closest("[data-effect-id]");
        return li ? this.item.effects.get(li.dataset.effectId) : undefined;
    }
}

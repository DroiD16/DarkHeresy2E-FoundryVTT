import { DarkHeresyItemSheet } from "./item.js";

export class AmmunitionSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "ammunition"],
        // Taller than the base item sheet so the special-quality add row and chip
        // list fit below the existing stats. The window stays resizable and a long
        // chip list scrolls internally instead of clipping its controls.
        position: { width: 500, height: 420 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/ammunition.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };

    // Serializes special-quality array writes. A burst of add/value/remove events
    // would otherwise each rebuild from the same stale snapshot (item.update is
    // async) and drop earlier edits; chaining on one promise makes each mutation
    // read the result of the previous update. Mirrors the weapon sheet.
    #qualityMutations = Promise.resolve();

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Special-qualities chip editor, mirroring the weapon sheet but nested
        // under `effect`. Chips read the FULL weaponQualities map so a stored
        // quality outside the curated set still renders; only the add-dropdown
        // is curated to ammunitionQualityKeys.
        const config = game.darkHeresy.config;
        const cfg = config.weaponQualities;
        const current = this.item.system.effect.specialQualities ?? [];
        context.qualityChips = current.map((q, index) => {
            const entry = cfg[q.key];
            return {
                index,
                key: q.key,
                label: entry ? game.i18n.localize(entry.labelKey) : q.key,
                hasValue: !!entry?.hasValue,
                value: q.value ?? entry?.default ?? null
            };
        });
        // Add-dropdown options: curated ammo keys NOT already present, sorted
        // by localized label so the list reads alphabetically per locale.
        const present = new Set(current.map(q => q.key));
        const curated = new Set(config.ammunitionQualityKeys);
        context.qualityOptions = Object.entries(cfg)
            .filter(([key]) => curated.has(key) && !present.has(key))
            .map(([key, entry]) => ({ key, label: game.i18n.localize(entry.labelKey) }))
            .sort((a, b) => a.label.localeCompare(b.label));
        return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // Special-qualities chip editor. Three delegated listeners bound ONCE on
        // the persistent frame (the weapon/psychic precedent): this.element
        // survives submitOnChange re-renders, so these keep working without
        // rebinding. Each resolves its control via closest() and bails when the
        // event is elsewhere, so the rest of the sheet is ignored. Every array
        // mutation goes through an explicit item.update({"system.effect.specialQualities":
        // next}) with a freshly rebuilt {key, value} array — NOT indexed named
        // inputs (ArrayField form re-coercion is version-sensitive). The chips
        // carry no `name`, so the form's own submitOnChange never includes
        // specialQualities and cannot clobber these writes.
        const element = this.element;

        // Add: choosing a quality in the add-dropdown appends it (deduped) and
        // resets the select back to its placeholder.
        element.addEventListener("change", event => {
            const select = event.target.closest(".add-quality-select");
            if (!select || !this.isEditable) return;
            const key = select.value;
            select.value = ""; // Always restore the placeholder.
            if (!key) return;
            const entry = game.darkHeresy.config.weaponQualities[key];
            if (!entry) return;
            this.#mutateQualities(current => {
                if (current.some(q => q.key === key)) return null; // Dedupe.
                current.push({ key, value: entry.hasValue ? entry.default ?? null : null });
                return current;
            });
        });

        // Value edit: a parametric chip's number input commits to its quality.
        // Identity is the quality KEY (stable), not the row index (shifts on
        // remove), so a queued edit always targets the right entry.
        element.addEventListener("change", event => {
            const input = event.target.closest(".quality-value-input");
            if (!input || !this.isEditable) return;
            const key = input.dataset.key;
            const raw = input.value.trim();
            const parsed = raw === "" ? null : parseInt(raw, 10);
            const value = Number.isNaN(parsed) ? null : Math.max(0, parsed);
            this.#mutateQualities(current => {
                const entry = current.find(q => q.key === key);
                if (!entry) return null;
                entry.value = value;
                return current;
            });
        });

        // Remove: the trash icon deletes its quality (keyed, not indexed).
        element.addEventListener("click", event => {
            const btn = event.target.closest(".remove-quality");
            if (!btn || !this.isEditable) return;
            event.preventDefault();
            const key = btn.dataset.key;
            this.#mutateQualities(current => {
                const next = current.filter(q => q.key !== key);
                return next.length === current.length ? null : next;
            });
        });
    }

    /**
     * Apply a mutation to `system.effect.specialQualities`, serialized so
     * concurrent add/value/remove events cannot rebuild from a stale snapshot and
     * drop edits. The mutator receives a fresh shallow copy of the current
     * `{key, value}` entries and returns the next array, or `null` for no change.
     * @param {(current: {key: string, value: (number|null)}[]) => (object[]|null)} mutator
     * @returns {Promise<void>} Resolves when this mutation (and its predecessors) complete.
     */
    #mutateQualities(mutator) {
        this.#qualityMutations = this.#qualityMutations.then(async () => {
            const current = (this.item.system.effect.specialQualities ?? []).map(q => ({ key: q.key, value: q.value }));
            const next = mutator(current);
            if (next) await this.item.update({ "system.effect.specialQualities": next });
        }).catch(err => console.error("dark-heresy | special-quality update failed:", err));
        return this.#qualityMutations;
    }
}

import { DarkHeresyItemSheet } from "./item.js";

export class WeaponSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "weapon"],
        // Taller than the base item sheet to fit the special-qualities row; the
        // window stays resizable and the chip list scrolls internally (see
        // weapon-qualities.less), so a long quality list never clips its controls.
        position: { width: 500, height: 440 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/weapon.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };

    // Serializes special-quality array writes. A burst of add/value/remove events
    // would otherwise each rebuild from the same stale snapshot (item.update is
    // async) and drop earlier edits; chaining on one promise makes each mutation
    // read the result of the previous update.
    #qualityMutations = Promise.resolve();

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const cfg = game.darkHeresy.config.weaponQualities;
        const current = this.item.system.specialQualities ?? [];
        // Chips for the stored qualities: localized label, the parametric value
        // (stored value, else the per-quality default), and a hasValue flag that
        // drives the per-chip number input. Index-keyed so the delegated
        // add/value/remove listeners can target the right array slot.
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
        // Add-dropdown options: every known quality NOT already on the weapon,
        // sorted by localized label so the list reads alphabetically per locale.
        const present = new Set(current.map(q => q.key));
        context.qualityOptions = Object.entries(cfg)
            .filter(([key]) => !present.has(key))
            .map(([key, entry]) => ({ key, label: game.i18n.localize(entry.labelKey) }))
            .sort((a, b) => a.label.localeCompare(b.label));
        return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // Allow dropping ammunition onto a weapon to link it (whole-sheet drop
        // target, matching the V1 `dropSelector: null`). The frame persists, so
        // binding once here covers re-rendered parts.
        new foundry.applications.ux.DragDrop.implementation({
            dropSelector: null,
            permissions: { drop: () => true },
            callbacks: { drop: this._onDrop.bind(this) }
        }).bind(this.element);

        // Special-qualities chip editor. Three delegated listeners bound ONCE on
        // the persistent frame (the aptitude/actor precedent): this.element
        // survives submitOnChange re-renders, so these keep working without
        // rebinding. Each resolves its control via closest() and bails when the
        // event is elsewhere, so the rest of the sheet is ignored. Every array
        // mutation goes through an explicit item.update({"system.specialQualities":
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
            const value = Number.isNaN(parsed) ? null : parsed;
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
     * Apply a mutation to `system.specialQualities`, serialized so concurrent
     * add/value/remove events cannot rebuild from a stale snapshot and drop
     * edits. The mutator receives a fresh shallow copy of the current
     * `{key, value}` entries and returns the next array, or `null` for no change.
     * @param {(current: {key: string, value: (number|null)}[]) => (object[]|null)} mutator
     * @returns {Promise<void>} Resolves when this mutation (and its predecessors) complete.
     */
    #mutateQualities(mutator) {
        this.#qualityMutations = this.#qualityMutations.then(async () => {
            const current = (this.item.system.specialQualities ?? []).map(q => ({ key: q.key, value: q.value }));
            const next = mutator(current);
            if (next) await this.item.update({ "system.specialQualities": next });
        }).catch(err => console.error("dark-heresy | special-quality update failed:", err));
        return this.#qualityMutations;
    }

    /**
     * Handle a drop on the weapon sheet: link same-actor ammunition.
     * @param {DragEvent} event  The drop event.
     */
    async _onDrop(event) {
        const dragEventData = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        const item = fromUuidSync(dragEventData.uuid);

        // We only want to allow drops on weapons that belong to an actor
        if (!this.item.actor) return;

        // It has to be ammunition from the same actor
        if (item?.type === "ammunition" && item?.actor.uuid === this.item.actor.uuid) {
            item.update({ "system.weaponId": this.item.id });
            const newAmmos = new Set(this.item.system.ammo);
            newAmmos.add(item.id);
            this.item.update({ "system.ammo": newAmmos });
        }
    }
}

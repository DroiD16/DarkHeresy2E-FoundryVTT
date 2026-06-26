import { DarkHeresyItemSheet } from "./item.js";
import { linkAmmunition, unlinkWeaponAmmunitionOne } from "../common/ammunition-link.js";

export class WeaponSheet extends DarkHeresyItemSheet {
    static QUALITY_EDITOR = {
        systemPath: "system.specialQualities",
        curatedKeys: null
    };

    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "weapon"],
        // Taller than the base item sheet to fit the separate Special and
        // special-quality chip rows. The window stays resizable and a long chip
        // list scrolls internally instead of clipping its controls.
        position: { height: 480 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/weapon.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };

    // Re-entrancy guard for ammunition link/unlink. Set while an update is in
    // flight so a second fast click/select can't snapshot the same stored `ammo`
    // array and clobber the first write. Lives on the instance, which (with the
    // listeners bound once on the persistent frame) survives re-renders.
    #ammoMutating = false;

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.hasActor = !!this.item.actor;
        context.ammunitionOptions = this.item.actor
            ? this.item.actor.itemTypes.ammunition
                .toSorted((a, b) => a.sort - b.sort)
                .map(ammunition => ({ id: ammunition.id, name: ammunition.name }))
            : [];
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

        const element = this.element;

        element.addEventListener("change", async event => {
            const select = event.target.closest(".weapon-ammunition-add");
            if (!select || !this.isEditable || !this.item.actor) return;
            const ammunition = this.item.actor.items.get(select.value);
            // Reset the add-select back to its blank prompt so the same ammo can be
            // re-picked and so the control never appears to "hold" a selection.
            select.value = "";
            // Ignore a re-entrant link while a prior link/unlink is still writing:
            // both would snapshot the same stored `ammo` array and the later write
            // would clobber the earlier change. The user re-picks after the render.
            if (!ammunition || this.#ammoMutating) return;
            this.#ammoMutating = true;
            try {
                await linkAmmunition(this.item, ammunition);
            } finally {
                this.#ammoMutating = false;
            }
        });

        element.addEventListener("click", async event => {
            const button = event.target.closest(".weapon-ammunition-unlink");
            if (!button || !this.isEditable || !this.item.actor) return;
            event.preventDefault();
            const ammoId = button.dataset.ammoId;
            if (!ammoId || this.#ammoMutating) return;
            this.#ammoMutating = true;
            try {
                await unlinkWeaponAmmunitionOne(this.item, ammoId);
            } finally {
                this.#ammoMutating = false;
            }
        });

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

        // It has to be ammunition from the same actor. Resolve the actor's
        // canonical embedded document so linkAmmunition receives two documents
        // from the same collection even if the drop returned a rehydrated copy.
        if (item?.type !== "ammunition" || item.actor?.uuid !== this.item.actor.uuid) return;
        const ammunition = this.item.actor.items.get(item.id);
        // Share the link/unlink re-entrancy guard so a drop can't race the
        // add-select or a chip-unlink and clobber the stored `ammo` array.
        if (ammunition?.type !== "ammunition" || this.#ammoMutating) return;
        this.#ammoMutating = true;
        try {
            await linkAmmunition(this.item, ammunition);
        } finally {
            this.#ammoMutating = false;
        }
    }
}

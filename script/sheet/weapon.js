import { DarkHeresyItemSheet } from "./item.js";

export class WeaponSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "weapon"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/weapon.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };

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
    }

    /**
     * Handle a drop on the weapon sheet: link same-actor ammunition.
     * @param {DragEvent} event  The drop event.
     */
    async _onDrop(event) {
        const dragEventData = TextEditor.getDragEventData(event);
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

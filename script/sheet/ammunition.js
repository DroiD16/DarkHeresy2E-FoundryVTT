import { DarkHeresyItemSheet } from "./item.js";
import { linkAmmunition, unlinkAmmunition } from "../common/ammunition-link.js";
import { AMMUNITION_QUALITY_KEYS } from "../common/weapon-qualities.js";

export class AmmunitionSheet extends DarkHeresyItemSheet {
    static QUALITY_EDITOR = {
        systemPath: "system.effect.specialQualities",
        curatedKeys: AMMUNITION_QUALITY_KEYS
    };

    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "ammunition"],
        // Taller than the base item sheet so the special-quality add row and chip
        // list fit below the existing stats. The window stays resizable and a long
        // chip list scrolls internally instead of clipping its controls.
        position: { height: 460 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/ammunition.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.hasActor = !!this.item.actor;
        context.weaponOptions = this.item.actor
            ? this.item.actor.itemTypes.weapon
                .toSorted((a, b) => a.sort - b.sort)
                .map(weapon => ({ id: weapon.id, name: weapon.name }))
            : [];
        return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        const element = this.element;

        element.addEventListener("change", event => {
            const select = event.target.closest(".ammunition-weapon-select");
            if (!select || !this.isEditable || !this.item.actor) return;
            const weapon = this.item.actor.items.get(select.value);
            if (weapon) linkAmmunition(weapon, this.item);
            else unlinkAmmunition(this.item);
        });

        element.addEventListener("click", event => {
            const button = event.target.closest(".ammunition-unlink");
            if (!button || !this.isEditable || !this.item.actor) return;
            event.preventDefault();
            unlinkAmmunition(this.item);
        });

    }
}

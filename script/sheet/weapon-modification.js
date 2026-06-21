import { DarkHeresyItemSheet } from "./item.js";

export class WeaponModificationSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "weapon-modification"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/weapon-modification.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };
}

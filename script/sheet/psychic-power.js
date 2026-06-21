import { DarkHeresyItemSheet } from "./item.js";

export class PsychicPowerSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "psychic-power"],
        position: { height: 397 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/psychic-power.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };
}

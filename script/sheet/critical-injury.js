import { DarkHeresyItemSheet } from "./item.js";

export class CriticalInjurySheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "critical-injury"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/critical-injury.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };
}

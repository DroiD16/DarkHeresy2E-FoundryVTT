import { DarkHeresyItemSheet } from "./item.js";

export class CyberneticSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "cybernetic"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/cybernetic.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };
}

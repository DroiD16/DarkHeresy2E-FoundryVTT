import { DarkHeresyItemSheet } from "./item.js";

export class MalignancySheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "malignancy"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/malignancy.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };
}

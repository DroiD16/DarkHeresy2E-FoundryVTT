import { DarkHeresyItemSheet } from "./item.js";

export class MutationSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "mutation"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/mutation.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };
}

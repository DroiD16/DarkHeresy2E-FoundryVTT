import { DarkHeresySheet } from "./actor.js";

export class AcolyteSheet extends DarkHeresySheet {
    static DEFAULT_OPTIONS = {
        classes: ["acolyte"],
        position: { width: 815 }
    };

    static PARTS = {
        form: {
            template: "systems/dark-heresy/template/sheet/actor/acolyte.hbs"
        }
    };
}

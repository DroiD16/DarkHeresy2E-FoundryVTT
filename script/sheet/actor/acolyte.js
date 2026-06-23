import { DarkHeresySheet } from "./actor.js";

export class AcolyteSheet extends DarkHeresySheet {
    static get DEFAULT_OPTIONS() {
        const isRussian = game.i18n.lang === "ru";
        return {
            classes: ["acolyte", ...(isRussian ? ["lang-ru"] : [])],
            position: { width: isRussian ? 900 : 815 }
        };
    }

    static PARTS = {
        form: {
            template: "systems/dark-heresy/template/sheet/actor/acolyte.hbs"
        }
    };
}

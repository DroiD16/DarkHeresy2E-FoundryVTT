import { DarkHeresySheet } from "./actor.js";

export class NpcSheet extends DarkHeresySheet {
    static DEFAULT_OPTIONS = {
        classes: ["npc"],
        position: { width: 820 }
    };

    static PARTS = {
        form: {
            template: "systems/dark-heresy/template/sheet/actor/npc.hbs"
        }
    };
}

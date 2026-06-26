import { DarkHeresyItemSheet } from "./item.js";

export class TalentSheet extends DarkHeresyItemSheet {
    // Drive the aptitudes chip control through the shared editor. Aptitudes use a
    // dedicated config map (canonical aptitude tags, no numeric value) and offer
    // the full list (curatedKeys: null).
    static QUALITY_EDITOR = {
        systemPath: "system.aptitudes",
        curatedKeys: null,
        config: "talentAptitudes"
    };

    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "talent"],
        // Taller than the base item sheet so the aptitude add row and chip list
        // fit below the stats. The window stays resizable and a long chip list
        // scrolls internally instead of clipping its controls.
        position: { height: 420 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/talent.hbs",
            templates: [
                "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
                "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs"
            ]
        }
    };
}

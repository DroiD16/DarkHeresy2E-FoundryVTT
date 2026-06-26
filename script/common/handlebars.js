import { dropQualitiesFromText } from "./quality-parser.js";

export const initializeHandlebars = () => {
    registerHandlebarsHelpers();
    preloadHandlebarsTemplates();
};

/**
 * Define a set of template paths to pre-load. Pre-loaded templates are compiled and cached for fast access when
 * rendering. These paths will also be available as Handlebars partials by using the file name.
 * @returns {Promise}
 */
function preloadHandlebarsTemplates() {
    const templatePaths = [
        "systems/dark-heresy/template/sheet/actor/acolyte.hbs",
        "systems/dark-heresy/template/sheet/actor/npc.hbs",
        "systems/dark-heresy/template/sheet/actor/limited-sheet.hbs",

        "systems/dark-heresy/template/sheet/actor/tab/abilities.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/combat.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/gear.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/notes.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/npc-notes.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/npc-stats.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/progression.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/psychic-powers.hbs",
        "systems/dark-heresy/template/sheet/actor/tab/stats.hbs",

        "systems/dark-heresy/template/sheet/mental-disorder.hbs",
        "systems/dark-heresy/template/sheet/aptitude.hbs",
        "systems/dark-heresy/template/sheet/malignancy.hbs",
        "systems/dark-heresy/template/sheet/mutation.hbs",
        "systems/dark-heresy/template/sheet/talent.hbs",
        "systems/dark-heresy/template/sheet/trait.hbs",
        "systems/dark-heresy/template/sheet/special-ability.hbs",
        "systems/dark-heresy/template/sheet/psychic-power.hbs",
        "systems/dark-heresy/template/sheet/critical-injury.hbs",
        "systems/dark-heresy/template/sheet/weapon.hbs",
        "systems/dark-heresy/template/sheet/armour.hbs",
        "systems/dark-heresy/template/sheet/gear.hbs",
        "systems/dark-heresy/template/sheet/drug.hbs",
        "systems/dark-heresy/template/sheet/tool.hbs",
        "systems/dark-heresy/template/sheet/cybernetic.hbs",
        "systems/dark-heresy/template/sheet/weapon-modification.hbs",
        "systems/dark-heresy/template/sheet/ammunition.hbs",
        "systems/dark-heresy/template/sheet/force-field.hbs",
        "systems/dark-heresy/template/sheet/item/parts/effect-part.hbs",
        "systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs",
        "systems/dark-heresy/template/sheet/item/parts/effect-tab-nav.hbs",

        "systems/dark-heresy/template/sheet/characteristics/information.hbs",
        "systems/dark-heresy/template/sheet/characteristics/left.hbs",
        "systems/dark-heresy/template/sheet/characteristics/name.hbs",
        "systems/dark-heresy/template/sheet/characteristics/right.hbs",
        "systems/dark-heresy/template/sheet/characteristics/total.hbs",

        "systems/dark-heresy/template/chat/item.hbs",
        "systems/dark-heresy/template/chat/roll.hbs",
        "systems/dark-heresy/template/chat/damage.hbs",
        "systems/dark-heresy/template/chat/critical.hbs",
        "systems/dark-heresy/template/chat/evasion.hbs",
        "systems/dark-heresy/template/chat/emptyMag.hbs",
        "systems/dark-heresy/template/chat/phenomena.hbs",

        "systems/dark-heresy/template/dialog/common-roll.hbs",
        "systems/dark-heresy/template/dialog/combat-roll.hbs",
        "systems/dark-heresy/template/dialog/psychic-power-roll.hbs"
    ];
    return foundry.applications.handlebars.loadTemplates(templatePaths);
}

/**
 * Add custom Handlerbars helpers.
 */
function registerHandlebarsHelpers() {
    Handlebars.registerHelper("removeMarkup", function(text) {
        const markup = /<(.*?)>/gi;
        return text.replace(markup, "");
    });

    Handlebars.registerHelper("damageTypeLong", function(damageType) {
        damageType = (damageType || "i").toLowerCase();
        switch (damageType) {
            case "e":
                return game.i18n.localize("DAMAGE_TYPE.ENERGY");
            case "i":
                return game.i18n.localize("DAMAGE_TYPE.IMPACT");
            case "r":
                return game.i18n.localize("DAMAGE_TYPE.RENDING");
            case "x":
                return game.i18n.localize("DAMAGE_TYPE.EXPLOSIVE");
            default:
                return game.i18n.localize("DAMAGE_TYPE.IMPACT");
        }
    });


    Handlebars.registerHelper("damageTypeShort", function(damageType) {
        switch (damageType) {
            case "energy":
                return game.i18n.localize("DAMAGE_TYPE.ENERGY_SHORT");
            case "impact":
                return game.i18n.localize("DAMAGE_TYPE.IMPACT_SHORT");
            case "rending":
                return game.i18n.localize("DAMAGE_TYPE.RENDING_SHORT");
            case "explosive":
                return game.i18n.localize("DAMAGE_TYPE.EXPLOSIVE_SHORT");
            default:
                return game.i18n.localize("DAMAGE_TYPE.IMPACT_SHORT");
        }
    });

    Handlebars.registerHelper("config", function(key) {
        return game.darkHeresy.config[key];
    });

    // Display-only localization of an aptitude name: when `name` is one of the
    // canonical English tags in the aptitude map, return its localized label;
    // otherwise return the raw name unchanged so custom/unmapped values display
    // verbatim and are never blanked. This never writes back into `name`; the
    // XP cost calc continues to match the stored canonical tag.
    Handlebars.registerHelper("aptitudeLabel", function(name) {
        const key = game.darkHeresy?.config?.aptitudes?.[name];
        return key ? game.i18n.localize(key) : name;
    });

    // Display-only, localized rendering of a talent's structured aptitudes for
    // the chat card: each stored {key} becomes its localized aptitude label
    // (canonical English tags map via config.aptitudes; unknown/custom keys fall
    // back to the raw key so nothing is silently blanked), joined by commas. The
    // stored canonical key is never written back; XP cost continues to match it.
    Handlebars.registerHelper("talentAptitudesDisplay", function(aptitudes) {
        const map = game.darkHeresy?.config?.aptitudes ?? {};
        return (Array.isArray(aptitudes) ? aptitudes : [])
            .map(a => {
                const key = map[a?.key];
                return key ? game.i18n.localize(key) : a?.key;
            })
            .filter(label => label != null && label !== "")
            .join(", ");
    });

    // Display-only localization of a psychic power's Focus Power test value:
    // when `name` is one of the canonical char/skill KEYS in the focus-power
    // test map, return its localized label; otherwise return the raw value
    // unchanged so legacy free-text values display verbatim and are never
    // blanked ('' renders empty, which is a legal value for this field). This
    // never writes back; getFocusPowerTarget resolves the stored KEY.
    Handlebars.registerHelper("focusTestLabel", function(name) {
        const key = game.darkHeresy?.config?.focusPowerTests?.[name];
        return key ? game.i18n.localize(key) : name;
    });

    // Display-only, localized rendering of a weapon's special qualities: each
    // structured quality becomes its localized label (with " (N)" appended for
    // parametric qualities, using the stored value or the per-quality default),
    // then the leftover custom free-text `special` is appended. All parts are
    // joined by commas with no stray separators for any empty/non-empty mix.
    // Unknown keys fall back to the raw key so nothing is silently blanked.
    //
    // The free text is kept intact in the data (the migration seeds chips without
    // stripping it), so any token already shown as a chip is dropped from the
    // leftover here to avoid rendering a quality twice (e.g. "Accurate, custom"
    // beside an Accurate chip → only "custom" is appended).
    //
    // Each known quality whose descKey localizes to a non-empty string is wrapped
    // in a <span data-tooltip="..."> so hovering it shows the rulebook description
    // (themed via data-tooltip-class). Returning a Handlebars.SafeString disables
    // the {{ }} auto-escaping the read-only callers relied on, so EVERY dynamic
    // piece (label, value, desc attribute, and the user-entered leftover free
    // text) is run through Handlebars.escapeExpression; only the comma separators
    // and the static <span> markup are literal. Unknown keys, empty descriptions,
    // and the leftover free-text emit bare escaped text with no tooltip span.
    Handlebars.registerHelper("weaponSpecialDisplay", function(specialQualities, special) {
        const cfg = game.darkHeresy?.config?.weaponQualities ?? {};
        const escape = Handlebars.escapeExpression;
        const parts = [];
        for (const q of specialQualities ?? []) {
            const entry = cfg[q?.key];
            const label = entry ? game.i18n.localize(entry.labelKey) : q?.key;
            if (label == null || label === "") continue;
            let text = escape(label);
            if (entry?.hasValue) {
                text += ` (${escape(String(q?.value ?? entry.default))})`;
            }
            const desc = entry?.descKey ? game.i18n.localize(entry.descKey) : "";
            if (entry && desc) {
                parts.push(`<span data-tooltip="${escape(desc)}" data-tooltip-class="dark-heresy-tooltip">${text}</span>`);
            } else {
                parts.push(text);
            }
        }
        const leftover = dropQualitiesFromText(special, (specialQualities ?? []).map(q => q?.key));
        if (leftover) parts.push(escape(leftover));
        return new Handlebars.SafeString(parts.join(", "));
    });

    // Summarize an Active Effect's `changes` as readable "<target> <±value>"
    // pairs (e.g. "Weapon Skill +5"), shown in the item effect list in place of
    // the redundant source column. The target is humanized from the change key
    // (characteristics/skills get their stat name, with the field in parens when
    // it isn't the base value); the mode selects the operator symbol.
    Handlebars.registerHelper("effectChanges", function(effect) {
        const modes = CONST.ACTIVE_EFFECT_MODES;
        const symbols = {
            [modes.ADD]: "+", [modes.MULTIPLY]: "×", [modes.OVERRIDE]: "=",
            [modes.UPGRADE]: "↑", [modes.DOWNGRADE]: "↓", [modes.CUSTOM]: "•"
        };
        const humanize = s => String(s).replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
        const label = key => {
            const parts = String(key).replace(/^system\./, "").split(".");
            if ((parts[0] === "characteristics" || parts[0] === "skills") && parts[1]) {
                let l = humanize(parts[1]);
                const field = parts[2];
                if (field && field !== "base" && field !== "total") l += ` (${field})`;
                return l;
            }
            if (parts[0] === "armour" && parts[1]) return `${humanize(parts[1])} Armour`;
            if (parts[0] === "movement" && parts[1]) return `${humanize(parts[1])} Movement`;
            if (parts[0] === "modifiers" && parts[1]) return humanize(parts.slice(1).join(" "));
            if (parts[0] === "fatigue" && parts[1] === "base") return "Fatigue";
            return humanize(parts[parts.length - 1] || key);
        };
        const changes = effect?.changes ?? [];
        return changes.map(c => {
            const sym = symbols[c.mode] ?? "";
            const v = String(c.value ?? "");
            const val = (c.mode === modes.ADD && v.startsWith("-")) ? v : `${sym}${v}`;
            return `${label(c.key)} ${val}`;
        }).join(", ");
    });

}

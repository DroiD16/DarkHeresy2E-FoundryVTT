// Free-text quality helpers: parse legacy free-text into the structured
// `specialQualities` shape and resolve a legacy free-text `focusPower.test` to
// its canonical key (used by the one-time world migration), plus strip
// already-structured tokens from free text for display (used by the
// weaponSpecialDisplay handlebars helper).
//
// This module is PURE and import-safe (no Foundry globals at module scope) so it
// is unit-testable under node:test. It sources quality metadata from
// weapon-qualities.js (also pure); it must NOT import config.js, which touches
// CONFIG at module load.
//
// These helpers back the one-time world migration only. They are NOT read-time
// shims: free-text is never parsed on every document load (the free-text fields
// remain decorative at runtime). The migration runs once per world on the
// schema-version bump.

import { WEAPON_QUALITIES } from "./weapon-qualities.js";

// English display names for every quality key (transcribed from lang/en.json
// WEAPON_QUALITY.*). Hardcoded in English on purpose: a Russian/other-locale
// world stores English free-text from upstream, so matching must be
// locale-independent and must not depend on game.i18n.
const ENGLISH_LABELS = {
    accurate: "Accurate",
    balanced: "Balanced",
    blast: "Blast",
    concussive: "Concussive",
    corrosive: "Corrosive",
    crippling: "Crippling",
    defensive: "Defensive",
    felling: "Felling",
    flame: "Flame",
    flexible: "Flexible",
    force: "Force",
    graviton: "Graviton",
    hallucinogenic: "Hallucinogenic",
    haywire: "Haywire",
    inaccurate: "Inaccurate",
    indirect: "Indirect",
    lance: "Lance",
    maximal: "Maximal",
    melta: "Melta",
    overheats: "Overheats",
    powerField: "Power Field",
    primitive: "Primitive",
    proven: "Proven",
    razorSharp: "Razor Sharp",
    recharge: "Recharge",
    reliable: "Reliable",
    sanctified: "Sanctified",
    scatter: "Scatter",
    shocking: "Shocking",
    smoke: "Smoke",
    snare: "Snare",
    spray: "Spray",
    storm: "Storm",
    tearing: "Tearing",
    toxic: "Toxic",
    twinLinked: "Twin-Linked",
    unbalanced: "Unbalanced",
    unreliable: "Unreliable",
    unwieldy: "Unwieldy",
    vengeful: "Vengeful"
};

// Reduce a name to letters only, lowercased: "Razor Sharp", "Razor-Sharp",
// "RazorSharp" and the camelCase key "razorSharp" all collapse to "razorsharp".
// Digits are stripped so a trailing numeric parameter never pollutes the name.
const normalizeName = name => String(name ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Name (letters-only) -> canonical key, built from both the English label and
// the key itself, so free-text written either way resolves.
const ALIASES = (() => {
    const map = {};
    for (const key of Object.keys(WEAPON_QUALITIES)) {
        map[normalizeName(key)] = key;
        if (ENGLISH_LABELS[key]) map[normalizeName(ENGLISH_LABELS[key])] = key;
    }
    return map;
})();

// Separators seen in real free-text quality lists: commas, semicolons, slashes,
// line breaks, and the word "and". (Space-only lists like "Accurate Tearing" are
// intentionally NOT split — substring scanning would risk false positives such as
// "Accurate" inside "Inaccurate"; such tokens are left in the decorative text.)
const QUALITY_SEPARATORS = /[\n\r;,/]+|\s+and\s+/i;

/**
 * Parse a free-text qualities string (e.g. "Accurate, Proven (3), Razor Sharp")
 * into the structured `[{ key, value }]` shape. Pure; no Foundry globals.
 *
 * - Tokens are split on commas, semicolons, slashes, line breaks, and "and"; an
 *   unrecognized token is skipped (left to remain in the decorative free-text
 *   field, never invented).
 * - A trailing integer ("Proven (3)", "Proven(3)", "Proven 3") becomes the
 *   value, clamped to a non-negative integer; non-parametric qualities ignore any
 *   stray number and store null; a parametric quality with no number uses its
 *   per-quality default (e.g. Primitive 7, Vengeful 9).
 * - Output is deduplicated by key (first occurrence wins).
 * - `allowedKeys`, when provided, restricts emitted keys to that set (matching
 *   the per-item-type curated chip dropdowns); pass null for "all qualities".
 * @param {string} text             The legacy free-text value.
 * @param {string[]|null} allowedKeys Permitted quality keys, or null for all.
 * @returns {{key: string, value: number|null}[]} Structured qualities.
 */
export function parseSpecialToQualities(text, allowedKeys = null) {
    if (typeof text !== "string" || text.trim() === "") return [];
    const allow = allowedKeys ? new Set(allowedKeys) : null;
    const out = [];
    const seen = new Set();
    for (const raw of text.split(QUALITY_SEPARATORS)) {
        const token = raw.trim();
        if (!token) continue;
        const key = ALIASES[normalizeName(token)];
        if (!key) continue;
        if (allow && !allow.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        const cfg = WEAPON_QUALITIES[key];
        let value = null;
        if (cfg.hasValue) {
            const numMatch = token.match(/(\d+)/);
            value = numMatch ? Math.max(0, parseInt(numMatch[1], 10)) : (cfg.default ?? null);
        }
        out.push({ key, value });
    }
    return out;
}

/**
 * Remove from a free-text qualities string the tokens that are already
 * represented by structured qualities, returning only the genuinely-custom
 * remainder. Pure; no Foundry globals.
 *
 * Used by the display layer: structured qualities are kept intact in the data
 * (the migration seeds chips without stripping the free text), so the merged
 * "chips + leftover" rendering would otherwise show a quality twice (e.g.
 * "Accurate, custom text" alongside an Accurate chip). A token is dropped only
 * when it resolves to a quality key present in `presentKeys`; unrecognized text
 * and qualities not in the chip list are preserved.
 * @param {string} freeText            The decorative free-text value.
 * @param {Iterable<string>} presentKeys Quality keys already shown as chips.
 * @returns {string} The custom remainder, comma-joined.
 */
export function dropQualitiesFromText(freeText, presentKeys) {
    if (typeof freeText !== "string" || freeText.trim() === "") return "";
    const present = new Set(presentKeys ?? []);
    const kept = [];
    for (const raw of freeText.split(QUALITY_SEPARATORS)) {
        const token = raw.trim();
        if (!token) continue;
        const key = ALIASES[normalizeName(token)];
        if (key && present.has(key)) continue;
        kept.push(token);
    }
    return kept.join(", ");
}

// Canonical focusPower.test keys -> English label (transcribed from lang/en.json
// CHARACTERISTIC.* / SKILL.*). Characteristics are listed FIRST so a label/short
// collision resolves to the characteristic, matching the runtime
// getFocusPowerTarget order. Hardcoded in English (not via game.i18n) so the
// migration matches legacy English free text regardless of the world's active
// locale (e.g. a Russian world still resolves a stored "Perception").
const FOCUS_TEST_LABELS = {
    weaponSkill: "Weapon Skill",
    ballisticSkill: "Ballistic Skill",
    strength: "Strength",
    toughness: "Toughness",
    agility: "Agility",
    intelligence: "Intelligence",
    perception: "Perception",
    willpower: "Willpower",
    fellowship: "Fellowship",
    influence: "Influence",
    acrobatics: "Acrobatics",
    athletics: "Athletics",
    awareness: "Awareness",
    charm: "Charm",
    command: "Command",
    commerce: "Commerce",
    commonLore: "Common Lore",
    deceive: "Deceive",
    dodge: "Dodge",
    forbiddenLore: "Forbidden Lore",
    inquiry: "Inquiry",
    interrogation: "Interrogation",
    intimidate: "Intimidate",
    linguistics: "Linguistics",
    logic: "Logic",
    medicae: "Medicae",
    navigate: "Navigate",
    operate: "Operate",
    parry: "Parry",
    psyniscience: "Psyniscience",
    scholasticLore: "Scholastic Lore",
    scrutiny: "Scrutiny",
    security: "Security",
    sleightOfHand: "Sleight Of Hand",
    stealth: "Stealth",
    survival: "Survival",
    techUse: "Tech Use",
    trade: "Trade"
};

// Characteristic short abbreviations, lowercased on lookup — extra aliases so a
// stored free-text test like "WP" or "BS" resolves. Skills have no short form.
const CHARACTERISTIC_SHORTS = {
    weaponSkill: "WS",
    ballisticSkill: "BS",
    strength: "S",
    toughness: "T",
    agility: "Ag",
    intelligence: "Int",
    perception: "Per",
    willpower: "WP",
    fellowship: "Fel",
    influence: "Inf"
};

// Lowercased token -> canonical key, built once from the key, its English label,
// and (characteristics only) its short abbreviation. First-wins (`??=`) with
// characteristics iterated first preserves the collision rule above.
const FOCUS_TEST_LOOKUP = (() => {
    const map = {};
    const add = (token, key) => {
        if (token) map[String(token).trim().toLowerCase()] ??= key;
    };
    for (const [key, label] of Object.entries(FOCUS_TEST_LABELS)) {
        add(key, key);
        add(label, key);
        add(CHARACTERISTIC_SHORTS[key], key);
    }
    return map;
})();

/**
 * Resolve a legacy free-text `focusPower.test` to its canonical key. Pure and
 * locale-independent (matches against hardcoded English labels, the keys
 * themselves, and characteristic shorts).
 *
 * Returns the canonical key ONLY when the stored value is not already canonical
 * and resolves unambiguously; otherwise returns null (meaning: leave the stored
 * value untouched). The runtime `getFocusPowerTarget` fallback still resolves
 * anything this declines to change, so declining is always safe.
 * @param {string} test The stored focusPower.test value.
 * @returns {string|null} The canonical key to persist, or null for no change.
 */
export function resolveFocusTestKey(test) {
    const value = String(test ?? "").trim();
    if (!value) return null;
    if (Object.hasOwn(FOCUS_TEST_LABELS, value)) return null; // Already canonical
    return FOCUS_TEST_LOOKUP[value.toLowerCase()] ?? null;
}

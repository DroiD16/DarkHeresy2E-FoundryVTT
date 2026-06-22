// Canonical source of truth for weapon special qualities (Dark Heresy 2E,
// Core Rulebook pp. 145-150). This module is PURE and import-safe: it touches no
// Foundry globals at module scope, so it is unit-testable under node:test and
// importable by both weaponData.js (migrateData) and util.js (trait builder)
// without circular deps.
//
// Field meanings per quality:
//   labelKey:     i18n key for display (en provided; other locales fall back).
//   hasValue:     true when the quality takes a numeric (N) parameter.
//   default:      per-quality default applied when hasValue and no value is
//                 supplied (NOT a blanket 1 -- a blanket 1 corrupts damage:
//                 Vengeful(1)=Righteous Fury on every die, Primitive(1)=damage~0).
//   trait:        the rollData.weapon.traits field this maps to. null = cosmetic
//                 quality with no current calc (serialize/localize/display only).
//   numericTrait: true when the trait stores the numeric value (not a boolean).
//
// The stored `key` (the object property below) is a stable, locale-independent
// slug; the localized name is RENDER-ONLY via labelKey.
export const WEAPON_QUALITIES = {
    accurate: { labelKey: "WEAPON_QUALITY.ACCURATE", hasValue: false, trait: "accurate" },
    balanced: { labelKey: "WEAPON_QUALITY.BALANCED", hasValue: false, trait: null },
    blast: { labelKey: "WEAPON_QUALITY.BLAST", hasValue: true, default: 1, trait: null },
    concussive: { labelKey: "WEAPON_QUALITY.CONCUSSIVE", hasValue: true, default: 1, trait: null },
    corrosive: { labelKey: "WEAPON_QUALITY.CORROSIVE", hasValue: false, trait: null },
    crippling: { labelKey: "WEAPON_QUALITY.CRIPPLING", hasValue: true, default: 1, trait: null },
    defensive: { labelKey: "WEAPON_QUALITY.DEFENSIVE", hasValue: false, trait: null },
    felling: { labelKey: "WEAPON_QUALITY.FELLING", hasValue: true, default: 1, trait: null },
    flame: { labelKey: "WEAPON_QUALITY.FLAME", hasValue: false, trait: null },
    flexible: { labelKey: "WEAPON_QUALITY.FLEXIBLE", hasValue: false, trait: null },
    force: { labelKey: "WEAPON_QUALITY.FORCE", hasValue: false, trait: "force" },
    graviton: { labelKey: "WEAPON_QUALITY.GRAVITON", hasValue: false, trait: null },
    hallucinogenic: { labelKey: "WEAPON_QUALITY.HALLUCINOGENIC", hasValue: true, default: 1, trait: null },
    haywire: { labelKey: "WEAPON_QUALITY.HAYWIRE", hasValue: true, default: 1, trait: null },
    inaccurate: { labelKey: "WEAPON_QUALITY.INACCURATE", hasValue: false, trait: "inaccurate" },
    indirect: { labelKey: "WEAPON_QUALITY.INDIRECT", hasValue: true, default: 1, trait: null },
    lance: { labelKey: "WEAPON_QUALITY.LANCE", hasValue: false, trait: "lance" },
    maximal: { labelKey: "WEAPON_QUALITY.MAXIMAL", hasValue: false, trait: "maximal" },
    melta: { labelKey: "WEAPON_QUALITY.MELTA", hasValue: false, trait: null },
    overheats: { labelKey: "WEAPON_QUALITY.OVERHEATS", hasValue: false, trait: "overheats" },
    powerField: { labelKey: "WEAPON_QUALITY.POWER_FIELD", hasValue: false, trait: null },
    primitive: { labelKey: "WEAPON_QUALITY.PRIMITIVE", hasValue: true, default: 7, trait: "primitive", numericTrait: true },
    proven: { labelKey: "WEAPON_QUALITY.PROVEN", hasValue: true, default: 3, trait: "proven", numericTrait: true },
    razorSharp: { labelKey: "WEAPON_QUALITY.RAZOR_SHARP", hasValue: false, trait: "razorSharp" },
    recharge: { labelKey: "WEAPON_QUALITY.RECHARGE", hasValue: false, trait: null },
    reliable: { labelKey: "WEAPON_QUALITY.RELIABLE", hasValue: false, trait: "reliable" },
    sanctified: { labelKey: "WEAPON_QUALITY.SANCTIFIED", hasValue: false, trait: null },
    scatter: { labelKey: "WEAPON_QUALITY.SCATTER", hasValue: false, trait: null },
    shocking: { labelKey: "WEAPON_QUALITY.SHOCKING", hasValue: false, trait: null },
    smoke: { labelKey: "WEAPON_QUALITY.SMOKE", hasValue: true, default: 1, trait: null },
    snare: { labelKey: "WEAPON_QUALITY.SNARE", hasValue: true, default: 1, trait: null },
    spray: { labelKey: "WEAPON_QUALITY.SPRAY", hasValue: false, trait: "spray" },
    storm: { labelKey: "WEAPON_QUALITY.STORM", hasValue: false, trait: "storm" },
    tearing: { labelKey: "WEAPON_QUALITY.TEARING", hasValue: false, trait: "tearing" },
    toxic: { labelKey: "WEAPON_QUALITY.TOXIC", hasValue: true, default: 1, trait: null },
    twinLinked: { labelKey: "WEAPON_QUALITY.TWIN_LINKED", hasValue: false, trait: "twinLinked" },
    unbalanced: { labelKey: "WEAPON_QUALITY.UNBALANCED", hasValue: false, trait: null },
    unreliable: { labelKey: "WEAPON_QUALITY.UNRELIABLE", hasValue: false, trait: "unreliable" },
    unwieldy: { labelKey: "WEAPON_QUALITY.UNWIELDY", hasValue: false, trait: null },
    vengeful: { labelKey: "WEAPON_QUALITY.VENGEFUL", hasValue: true, default: 9, trait: "rfFace", numericTrait: true }
};

// Normalize a name for matching: lowercase and strip everything that is not a
// letter or digit. Applied to each canonical camelCase key this yields the same
// string the English quality name normalizes to (razorSharp -> "razorsharp",
// twinLinked -> "twinlinked", powerField -> "powerfield"), which absorbs the
// hyphen/space/dot tolerances of the legacy free-text parser (Razor-Sharp,
// Razor Sharp, RazorSharp) for free. Matching is by EXACT normalized equality,
// so "Inaccurate" never collides with "Accurate" and stray prose like
// "razor sharpening kit" never matches "razorSharp".
const normalize = name => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");

// Alias table: normalized English name -> canonical key. Built from the keys
// themselves so it can never drift from WEAPON_QUALITIES (the pure module cannot
// call i18n, so display labels are not part of recognition).
const ALIASES = Object.fromEntries(
    Object.keys(WEAPON_QUALITIES).map(key => [normalize(key), key])
);

// Word-boundary regex per quality, used for the SECOND-PASS in-token scan (see
// parseSpecialString). The legacy whole-string parser matched a quality name
// ANYWHERE in the free text regardless of separator, so space-, slash-, or
// "and"-joined lists with no comma -- "Accurate Tearing", "Accurate / Tearing",
// "Storm and Tearing" -- detected every trait. The primary [,;\n]-split +
// exact-normalize pass turns each of those into a single unrecognized token; the
// fallback below restores the legacy detection breadth.
//
// Each pattern is generated from the canonical key (never a hand-maintained name
// list, so it cannot drift): camelCase is split into sub-words joined by an
// optional space/hyphen ("razorSharp" -> /\brazor[\s-]?sharp\b/i), so multi-word
// names (Razor Sharp, Power Field, Twin Linked) stay intact. The \b edges:
//   - prevent the Inaccurate/Accurate collision with no lookbehind: \bAccurate\b
//     cannot match inside "inaccurate" (no boundary between "in" and "accurate");
//   - keep stray prose out: \bRazor[\s-]?Sharp\b fails on "razor sharpening kit"
//     (the trailing \b is absent before "ening"), matching the deliberately
//     stricter-than-legacy prose behavior the existing tests lock in.
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const QUALITY_PATTERNS = Object.keys(WEAPON_QUALITIES).map(key => {
    const subWords = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ");
    const body = subWords.map(escapeRegExp).join("[\\s-]?");
    return { key, regex: new RegExp(`\\b${body}\\b`, "i") };
});

/**
 * Second-pass scan of an unrecognized token for known quality names appearing
 * anywhere within it (word-boundary anchored). Returns recognized keys in
 * ENCOUNTER order (the position each name appears in the token) plus the token
 * text with the matched names removed. A trailing "(N)" immediately after a
 * matched name is captured as that quality's value, so "Tearing Proven (3)"
 * recovers proven=3.
 * @param {string} token The trimmed, non-empty token that failed exact matching.
 * @returns {{found: {key: string, value: ?number}[], leftover: string}}
 *   The recognized qualities (encounter order) and the residual leftover text.
 */
function scanTokenForQualities(token) {
    const found = [];
    for (const { key, regex } of QUALITY_PATTERNS) {
        const match = regex.exec(token);
        if (match) {
            found.push({ key, index: match.index, length: match[0].length });
        }
    }
    if (found.length === 0) {
        return { found: [], leftover: token };
    }
    found.sort((a, b) => a.index - b.index);

    const recognized = [];
    // Mark the spans to remove from the token so the remainder is leftover.
    const removals = [];
    for (const hit of found) {
        let value = null;
        let end = hit.index + hit.length;
        if (WEAPON_QUALITIES[hit.key].hasValue) {
            const tail = token.slice(end);
            const valueMatch = tail.match(/^\s*\(\s*(\d+)\s*\)/);
            if (valueMatch) {
                value = parseInt(valueMatch[1], 10);
                end += valueMatch[0].length;
            }
        }
        recognized.push({ key: hit.key, value });
        removals.push([hit.index, end]);
    }

    // Build the leftover by blanking out every removed span, then collapsing the
    // residual separator noise (whitespace, slashes, stray punctuation).
    const chars = token.split("");
    for (const [start, end] of removals) {
        for (let i = start; i < end && i < chars.length; i++) {
            chars[i] = " ";
        }
    }
    const leftover = chars.join("")
        .replace(/ +/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[\s/&,;.+-]+|[\s/&,;.+-]+$/g, "")
        .trim();

    return { found: recognized, leftover };
}

/**
 * Parse a legacy free-text `special` string into structured qualities plus the
 * unrecognized leftover. Idempotent and order-preserving:
 *   - split on commas, semicolons, and newlines (the legacy whole-string regex
 *     parser matched a quality name anywhere regardless of separator, so
 *     hand-authored values like "Accurate; Tearing" or newline-separated lists
 *     must still be recognized). Spaces are NOT separators: multi-word quality
 *     names ("Razor Sharp", "Power Field", "Twin Linked") must stay one token;
 *   - for each token, trim, extract a trailing "(N)" integer as the value and
 *     strip it from the name;
 *   - normalize the name and match it (exact) against the alias table;
 *   - if the exact match fails, run a SECOND PASS that scans the token for known
 *     quality names anywhere within it (word-boundary anchored). This restores
 *     the legacy detection breadth for space-, slash-, or "and"-joined lists
 *     with no comma ("Accurate Tearing", "Accurate / Tearing", "Storm and
 *     Tearing"), which the primary split would otherwise drop to leftover and
 *     silently lose their mechanical trait effects on migration;
 *   - recognized -> push { key, value } (value = parsed N, else null);
 *   - unrecognized -> keep the leftover token text in the leftover;
 *   - dedupe recognized keys (first occurrence wins).
 * @param {string} special The free-text special string to parse.
 * @returns {{qualities: {key: string, value: ?number}[], leftover: string}}
 *   The recognized qualities and the comma-joined unrecognized leftover.
 */
export function parseSpecialString(special) {
    const qualities = [];
    const leftover = [];
    const seen = new Set();

    if (typeof special !== "string") {
        return { qualities, leftover: "" };
    }

    for (const rawToken of special.split(/[,;\n]/)) {
        const token = rawToken.trim();
        if (token === "") continue;

        // Extract a trailing parenthesized integer, e.g. "Proven (3)".
        const valueMatch = token.match(/\(\s*(\d+)\s*\)\s*$/);
        const value = valueMatch ? parseInt(valueMatch[1], 10) : null;
        const name = valueMatch ? token.slice(0, valueMatch.index) : token;

        const key = ALIASES[normalize(name)];
        if (key) {
            if (seen.has(key)) continue; // Dedupe; first occurrence wins.
            seen.add(key);
            qualities.push({ key, value: WEAPON_QUALITIES[key].hasValue ? value : null });
            continue;
        }

        // Second pass: the whole token did not match a quality name on its own,
        // so scan within it for known names (restores legacy whole-string
        // detection breadth for separator-less lists like "Accurate Tearing").
        const scanned = scanTokenForQualities(token);
        if (scanned.found.length > 0) {
            for (const q of scanned.found) {
                if (seen.has(q.key)) continue; // Dedupe; first occurrence wins.
                seen.add(q.key);
                qualities.push({
                    key: q.key,
                    value: WEAPON_QUALITIES[q.key].hasValue ? q.value : null
                });
            }
            if (scanned.leftover !== "") leftover.push(scanned.leftover);
        } else {
            leftover.push(token);
        }
    }

    return { qualities, leftover: leftover.join(", ") };
}

/**
 * Build the rollData.weapon.traits object from the structured qualities array.
 * This MUST match the shape extractWeaponTraits emits for the existing keys (so
 * migrated weapons behave identically), including skipAttackRoll === spray. The
 * five NEW keys (lance, maximal, reliable, unreliable, overheats) are additive
 * and inert until Chunk C wires them into roll.js.
 * @param {{key: string, value: ?number}[]} qualities The structured qualities.
 * @returns {object} The traits object consumed by roll.js.
 */
export function buildTraitsFromQualities(qualities) {
    const list = Array.isArray(qualities) ? qualities : [];
    const has = key => list.some(q => q?.key === key);
    const valueOf = key => {
        const q = list.find(x => x?.key === key);
        if (!q) return undefined; // Absent -> undefined, matching the old parser.
        return q.value ?? WEAPON_QUALITIES[key]?.default;
    };
    const spray = has("spray");
    return {
        accurate: has("accurate"),
        rfFace: valueOf("vengeful"),
        proven: valueOf("proven"),
        primitive: valueOf("primitive"),
        razorSharp: has("razorSharp"),
        spray: spray,
        skipAttackRoll: spray, // Kept coupled to spray, as today.
        tearing: has("tearing"),
        storm: has("storm"),
        twinLinked: has("twinLinked"),
        force: has("force"),
        inaccurate: has("inaccurate"),
        // Additive NEW keys (inert until Chunk C wires roll.js):
        lance: has("lance"),
        maximal: has("maximal"),
        reliable: has("reliable"),
        unreliable: has("unreliable"),
        overheats: has("overheats")
    };
}

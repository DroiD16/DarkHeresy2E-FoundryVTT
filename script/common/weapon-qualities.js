// Canonical source of truth for weapon special qualities (Dark Heresy 2E,
// Core Rulebook pp. 145-150). This module is PURE and import-safe: it touches no
// Foundry globals at module scope, so it is unit-testable under node:test.
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
    melta: { labelKey: "WEAPON_QUALITY.MELTA", hasValue: false, trait: "melta" },
    overheats: { labelKey: "WEAPON_QUALITY.OVERHEATS", hasValue: false, trait: "overheats" },
    powerField: { labelKey: "WEAPON_QUALITY.POWER_FIELD", hasValue: false, trait: null },
    primitive: { labelKey: "WEAPON_QUALITY.PRIMITIVE", hasValue: true, default: 7, trait: "primitive", numericTrait: true },
    proven: { labelKey: "WEAPON_QUALITY.PROVEN", hasValue: true, default: 3, trait: "proven", numericTrait: true },
    razorSharp: { labelKey: "WEAPON_QUALITY.RAZOR_SHARP", hasValue: false, trait: "razorSharp" },
    recharge: { labelKey: "WEAPON_QUALITY.RECHARGE", hasValue: false, trait: null },
    reliable: { labelKey: "WEAPON_QUALITY.RELIABLE", hasValue: false, trait: "reliable" },
    sanctified: { labelKey: "WEAPON_QUALITY.SANCTIFIED", hasValue: false, trait: null },
    scatter: { labelKey: "WEAPON_QUALITY.SCATTER", hasValue: false, trait: "scatter" },
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

// Curated subset of WEAPON_QUALITIES offered in the psychic-power sheet's
// add-quality dropdown (Dark Heresy 2E psychic powers). The full WEAPON_QUALITIES
// map still backs labels/defaults and chip rendering; only the ADD dropdown is
// restricted to these rules-relevant keys.
export const PSYCHIC_POWER_QUALITY_KEYS = ["blast", "concussive", "flame", "melta", "snare", "force", "haywire", "hallucinogenic"];

// Curated subset of WEAPON_QUALITIES offered in the ammunition sheet's
// add-quality dropdown (Dark Heresy 2E special ammunition). The full
// WEAPON_QUALITIES map still backs labels/defaults and chip rendering; only the
// ADD dropdown is restricted to these rules-relevant keys.
// NOTE: of these, only `tearing` is wired into the combat roll
// (buildTraitsFromQualities); the rest are `trait: null` display-only reminders
// (see the trait convention above) and have no automated effect when fired.
export const AMMUNITION_QUALITY_KEYS = ["blast", "flame", "hallucinogenic", "recharge", "shocking", "tearing", "toxic"];

const RANGE_BAND_MODIFIERS = Object.freeze({
    pointBlank: 30,
    pointBlankMelee: 0,
    short: 10,
    normal: 0,
    long: -10,
    extreme: -30
});

/**
 * Convert the semantic range-band selected in the combat dialog to its normal
 * Ballistic Skill modifier. Point Blank (Melee) deliberately has no range
 * bonus: pistols fired in close combat count as Point Blank for range-based
 * qualities but do not gain the usual +30 (Core Rulebook p. 143).
 * @param {string} rangeBand
 * @returns {number}
 */
export function rangeBandModifier(rangeBand) {
    return RANGE_BAND_MODIFIERS[rangeBand] ?? 0;
}

/**
 * Resolve the current semantic range band, falling back to the numeric range
 * modifier stored by chat cards created before semantic bands were introduced.
 * @param {string} rangeBand
 * @param {number} legacyRangeMod
 * @returns {string|undefined}
 */
export function resolveRangeBand(rangeBand, legacyRangeMod) {
    if (Object.hasOwn(RANGE_BAND_MODIFIERS, rangeBand)) return rangeBand;
    switch (Number(legacyRangeMod)) {
        case 30: return "pointBlank";
        case 10: return "short";
        case 0: return "normal";
        case -10: return "long";
        case -30: return "extreme";
        default: return undefined;
    }
}

/**
 * Calculate the range-dependent portions of Melta and Scatter. These effects
 * are derived each time a target or damage roll is resolved, so Fate rerolls
 * cannot append the same modifier more than once.
 * @param {object} traits rollData.weapon.traits.
 * @param {string} rangeBand Semantic range band.
 * @param {number} legacyRangeMod Numeric fallback for old chat cards.
 * @returns {{attackModifier: number, damageModifier: number, penetrationMultiplier: number}}
 */
export function rangeQualityEffects(traits, rangeBand, legacyRangeMod) {
    const resolvedBand = resolveRangeBand(rangeBand, legacyRangeMod);
    const isPointBlank = resolvedBand === "pointBlank" || resolvedBand === "pointBlankMelee";
    const isShortOrCloser = isPointBlank || resolvedBand === "short";
    const isLongerThanShort = ["normal", "long", "extreme"].includes(resolvedBand);

    return {
        attackModifier: traits?.scatter && isShortOrCloser ? 10 : 0,
        damageModifier: traits?.scatter ? (isPointBlank ? 3 : (isLongerThanShort ? -3 : 0)) : 0,
        penetrationMultiplier: traits?.melta && isShortOrCloser ? 2 : 1
    };
}

/**
 * Determine whether a weapon attack roll triggers a malfunction (Core Rulebook
 * pp. 142, 145-150, 224). Overheats (91+) replaces jamming entirely and applies
 * regardless of fire mode. Otherwise jamming is a RANGED-only rule: Reliable
 * narrows the jam window to a natural 100, Unreliable widens it to 91+, and the
 * base window is 96-100 for a single shot / 94-100 for Semi-Auto or Full-Auto.
 * Spray weapons never reach this (they skip the hit roll — see
 * computeSprayMalfunction), which structurally satisfies Reliable's "never jams
 * if it makes no hit roll".
 *
 * The model: first decide whether a malfunction is TRIGGERED, then map it to a
 * type. An Overheats weapon overheats instead of jamming and adds its own 91+
 * trigger ("any effect that would cause the weapon to jam instead causes the
 * weapon to overheat"); the only thing that suppresses overheating is Best
 * RANGED craftsmanship.
 *
 * Craftsmanship (p. 142) shifts the effective reliability of a RANGED weapon:
 *   - Best: never jams or overheats (ranged benefit only; melee Best is +WS/+dmg
 *     and does NOT grant malfunction immunity).
 *   - Good: loses Unreliable; if it had none, gains Reliable.
 *   - Poor: gains Unreliable; if it was ALREADY Unreliable, it ALSO jams on any
 *           failed hit roll (in addition to Unreliable's 91+ trigger).
 *   - Common: baseline.
 * @param {object} traits          rollData.weapon.traits (reliable, unreliable, overheats booleans).
 * @param {number} result         The unmodified d100 attack roll.
 * @param {string} attackTypeName rollData.attackType.name ("standard","semi_auto","full_auto",...).
 * @param {boolean} isRange        rollData.weapon.isRange.
 * @param {string} [craftsmanship] "poor" | "common" | "good" | "best".
 * @param {boolean} [isSuccess]    Whether the attack hit (only the Poor + already-Unreliable case uses it).
 * @returns {"jammed"|"overheated"|null} The malfunction type, or null for none.
 */
export function computeMalfunction(traits, result, attackTypeName, isRange, craftsmanship, isSuccess) {
    const overheats = !!traits?.overheats;
    // Best RANGED craftsmanship never jams or overheats; Best melee has no such effect.
    if (craftsmanship === "best" && isRange) return null;
    // Overheats has its own 91+ trigger (any fire mode), on top of converting jams.
    let triggered = overheats && result >= 91;
    // Jamming is a ranged-attack rule; compute its trigger and OR it in.
    if (isRange) {
        let reliable = !!traits?.reliable;
        let unreliable = !!traits?.unreliable;
        let jam = false;
        if (craftsmanship === "poor") {
            if (unreliable) {
                // Poor keeps Unreliable's 91+ trigger AND adds an any-failed-hit trigger.
                jam = result >= 91 || isSuccess === false;
            } else {
                // Poor grants Unreliable; this degradation overrides any Reliable
                // quality, so a Poor Reliable weapon jams at 91+ (not only on 100).
                unreliable = true;
                reliable = false;
            }
        } else if (craftsmanship === "good") {
            // Loses Unreliable; if it had none, gains Reliable.
            if (unreliable) unreliable = false;
            else reliable = true;
        }
        if (!jam) {
            let threshold;
            if (reliable) threshold = 100;
            else if (unreliable) threshold = 91;
            else threshold = (attackTypeName === "semi_auto" || attackTypeName === "full_auto") ? 94 : 96;
            jam = result >= threshold;
        }
        triggered = triggered || jam;
    }
    if (!triggered) return null;
    return overheats ? "overheated" : "jammed";
}

/**
 * Determine whether a Spray weapon malfunctions: it jams if any of its damage
 * dice shows a natural 9 (before modifiers) (Core Rulebook p. 149). Order of
 * precedence:
 *   - Best craftsmanship never jams or overheats.
 *   - Otherwise, if a 9 is rolled and the weapon has Overheats, it OVERHEATS —
 *     Overheats converts the jam-causing 9 into an overheat, and only Best
 *     craftsmanship suppresses overheating (Reliable/Good do not).
 *   - Otherwise an effectively-Reliable Spray weapon never jams ("Reliable
 *     weapons with the Spray quality ... never jam", p. 148): the Reliable
 *     quality, or Good craftsmanship when the weapon is not Unreliable.
 * @param {object} traits          rollData.weapon.traits.
 * @param {string} [craftsmanship] "poor" | "common" | "good" | "best".
 * @param {number[]} damageDice    The natural damage-die faces (before modifiers).
 * @returns {"jammed"|"overheated"|null} The malfunction type, or null for none.
 */
export function computeSprayMalfunction(traits, craftsmanship, damageDice) {
    if (craftsmanship === "best") return null; // Never jams or overheats.
    if (!(damageDice ?? []).some(d => d === 9)) return null;
    if (traits?.overheats) return "overheated"; // Overheats converts the 9-jam; only Best stops it.
    if (traits?.reliable) return null; // Reliable + Spray never jams.
    if (craftsmanship === "good" && !traits?.unreliable) return null; // Good grants Reliable.
    return "jammed";
}

/**
 * Apply the Lance quality to a rolled penetration value. Lance increases the
 * weapon's penetration by its BASE value once per degree of success (Core
 * Rulebook p. 147): total = full penetration + base x DoS. Only the base scales
 * per degree — additive bonuses already folded into `fullPen` (ammunition,
 * Force's +PR, Maximal's +2) are NOT multiplied by the degrees of success.
 * @param {number} fullPen  The fully-rolled penetration (base + additive bonuses, after any Razor Sharp x2).
 * @param {number} basePen  The weapon's own base penetration, rolled separately.
 * @param {number} dos      Degrees of success on the attack (clamped at 0).
 * @returns {number} The Lance-adjusted penetration.
 */
export function lancePenetration(fullPen, basePen, dos) {
    return fullPen + (basePen * Math.max(0, dos ?? 0));
}

/**
 * Calculate ammunition spent per nominal shot when several ammunition
 * multipliers apply. Dark Heresy combines multipliers additively: x2 and x3
 * become x4, not x6 (Core Rulebook p. 22). Storm and Twin-Linked each add x2;
 * firing on Maximal adds x3.
 * @param {object} traits rollData.weapon.traits.
 * @param {boolean} maximal Whether the weapon is firing on Maximal.
 * @returns {number} Ammunition units consumed per nominal shot.
 */
export function ammunitionMultiplier(traits, maximal) {
    let multiplier = 1;
    if (traits?.storm) multiplier += 1;
    if (traits?.twinLinked) multiplier += 1;
    if (maximal) multiplier += 2;
    return multiplier;
}

/**
 * Calculate a Maximal burst against the ammunition currently available. A
 * partial charge cannot fire a nominal shot; unused ammunition remains in the
 * clip. Storm doubles the hit capacity produced by each nominal shot, while
 * Twin-Linked's conditional extra hit remains handled by _computeNumberOfHits.
 * @param {number} clip Current ammunition in the clip.
 * @param {number} rate Nominal shots in the selected fire mode.
 * @param {object} traits rollData.weapon.traits.
 * @returns {{ammoSpent: number, shotsFired: number}} Maximal ammunition use and hit capacity.
 */
export function maximalAmmoUsage(clip, rate, traits) {
    const multiplier = ammunitionMultiplier(traits, true);
    const available = Math.max(0, Math.floor(Number(clip) || 0));
    const requestedShots = Math.max(0, Math.floor(Number(rate) || 0));
    const nominalShots = Math.min(requestedShots, Math.floor(available / multiplier));
    return {
        ammoSpent: nominalShots * multiplier,
        shotsFired: nominalShots * (traits?.storm ? 2 : 1)
    };
}

/**
 * Build the rollData.weapon.traits object from the structured qualities array,
 * including skipAttackRoll === spray for the existing combat-roll contract.
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
        lance: has("lance"),
        maximal: has("maximal"),
        melta: has("melta"),
        reliable: has("reliable"),
        scatter: has("scatter"),
        unreliable: has("unreliable"),
        overheats: has("overheats")
    };
}

/**
 * Merge a weapon's structured qualities with the qualities of the ammunition
 * loaded at fire time (Dark Heresy 2E special ammunition). The merge is an
 * additive UNION deduped by quality `key`: ammo qualities are added on top of
 * the weapon's own qualities and NEVER remove one (ammo "strip" cases are
 * deferred, out of scope). When the same parametric quality is present on both
 * sides, the HIGHER numeric value wins; a present value (a number) beats an
 * absent one (`null`), and both-absent stays `null`. Pure: it mutates neither
 * input and reads no WEAPON_QUALITIES defaults (those are applied later by
 * buildTraitsFromQualities). All weapon qualities are preserved, including
 * non-curated ones such as spray/reliable.
 * @param {{key: string, value: ?number}[]} weaponQualities The weapon's stored qualities.
 * @param {{key: string, value: ?number}[]} ammoQualities   The loaded ammo's stored qualities.
 * @returns {{key: string, value: ?number}[]} The merged {key, value} qualities.
 */
export function mergeSpecialQualities(weaponQualities, ammoQualities) {
    const out = new Map();
    const add = q => {
        if (!q?.key) return;
        const prev = out.get(q.key);
        if (!prev) { out.set(q.key, { key: q.key, value: q.value ?? null }); return; }
        const a = prev.value;
        const b = q.value;
        prev.value = a == null ? (b ?? null) : (b == null ? a : Math.max(a, b));
    };
    for (const q of weaponQualities ?? []) add(q);
    for (const q of ammoQualities ?? []) add(q);
    return [...out.values()];
}

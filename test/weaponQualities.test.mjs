import { test } from "node:test";
import assert from "node:assert/strict";

// The pure weapon-qualities module touches no Foundry globals at module scope,
// so it imports cleanly under node:test. DarkHeresyUtil likewise only references
// `foundry`/`game` inside method bodies (not at module load), and
// extractWeaponTraits uses only its own static helpers — so it can be imported
// and called directly to prove behavior parity for the shared trait keys.
const { WEAPON_QUALITIES, parseSpecialString, buildTraitsFromQualities } =
    await import("../script/common/weapon-qualities.js");
const { default: DarkHeresyUtil } = await import("../script/common/util.js");

// ---------------------------------------------------------------------------
// parseSpecialString
// ---------------------------------------------------------------------------

test("parseSpecialString: recognized non-parametric qualities + custom leftover", () => {
    const { qualities, leftover } = parseSpecialString("Inaccurate, Tearing, Custom note");
    assert.deepEqual(qualities, [
        { key: "inaccurate", value: null },
        { key: "tearing", value: null }
    ]);
    assert.equal(leftover, "Custom note");
});

test("parseSpecialString: hyphen/space variants normalize to canonical keys", () => {
    assert.deepEqual(parseSpecialString("Razor-Sharp").qualities, [{ key: "razorSharp", value: null }]);
    assert.deepEqual(parseSpecialString("Razor Sharp").qualities, [{ key: "razorSharp", value: null }]);
    assert.deepEqual(parseSpecialString("RazorSharp").qualities, [{ key: "razorSharp", value: null }]);
    assert.deepEqual(parseSpecialString("Twin-Linked").qualities, [{ key: "twinLinked", value: null }]);
    assert.deepEqual(parseSpecialString("Twin Linked").qualities, [{ key: "twinLinked", value: null }]);
    assert.deepEqual(parseSpecialString("Power Field").qualities, [{ key: "powerField", value: null }]);
});

test("parseSpecialString: parametric value parsed and stripped from name", () => {
    const { qualities, leftover } = parseSpecialString("Razor-Sharp, Proven (3)");
    assert.deepEqual(qualities, [
        { key: "razorSharp", value: null },
        { key: "proven", value: 3 }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: multi-digit parametric value", () => {
    assert.deepEqual(parseSpecialString("Blast (10)").qualities, [{ key: "blast", value: 10 }]);
});

test("parseSpecialString: parametric quality with no value -> null (default applied later)", () => {
    assert.deepEqual(parseSpecialString("Vengeful").qualities, [{ key: "vengeful", value: null }]);
});

test("parseSpecialString: parametric quality with explicit value", () => {
    assert.deepEqual(parseSpecialString("Vengeful (8)").qualities, [{ key: "vengeful", value: 8 }]);
});

test("parseSpecialString: value on a non-parametric quality is discarded", () => {
    // Tearing has no parameter; any parenthesized number is ignored (value null).
    assert.deepEqual(parseSpecialString("Tearing (4)").qualities, [{ key: "tearing", value: null }]);
});

test("parseSpecialString: exact-match avoids Inaccurate -> accurate collision", () => {
    assert.deepEqual(parseSpecialString("Inaccurate").qualities, [{ key: "inaccurate", value: null }]);
    assert.deepEqual(parseSpecialString("Accurate").qualities, [{ key: "accurate", value: null }]);
});

test("parseSpecialString: prose that merely contains a quality name is left as leftover", () => {
    const { qualities, leftover } = parseSpecialString("razor sharpening kit");
    assert.deepEqual(qualities, []);
    assert.equal(leftover, "razor sharpening kit");
});

test("parseSpecialString: dedupe keeps first occurrence", () => {
    const { qualities } = parseSpecialString("Proven (3), Proven (5)");
    assert.deepEqual(qualities, [{ key: "proven", value: 3 }]);
});

test("parseSpecialString: empty / whitespace / non-string input", () => {
    assert.deepEqual(parseSpecialString(""), { qualities: [], leftover: "" });
    assert.deepEqual(parseSpecialString("   "), { qualities: [], leftover: "" });
    assert.deepEqual(parseSpecialString(", ,"), { qualities: [], leftover: "" });
    assert.deepEqual(parseSpecialString(undefined), { qualities: [], leftover: "" });
    assert.deepEqual(parseSpecialString(null), { qualities: [], leftover: "" });
});

test("parseSpecialString: semicolon-separated list is recognized (legacy whole-string parity)", () => {
    // The legacy regex parser matched a quality name anywhere in the string
    // regardless of separator, so hand-authored "Accurate; Tearing" must still
    // resolve to both qualities rather than being dropped to leftover.
    const { qualities, leftover } = parseSpecialString("Accurate; Tearing");
    assert.deepEqual(qualities, [
        { key: "accurate", value: null },
        { key: "tearing", value: null }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: newline-separated list is recognized (legacy whole-string parity)", () => {
    const { qualities, leftover } = parseSpecialString("Inaccurate\nStorm");
    assert.deepEqual(qualities, [
        { key: "inaccurate", value: null },
        { key: "storm", value: null }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: mixed separators with custom leftover", () => {
    const { qualities, leftover } = parseSpecialString("Spray; Tearing\nCustom note");
    assert.deepEqual(qualities, [
        { key: "spray", value: null },
        { key: "tearing", value: null }
    ]);
    assert.equal(leftover, "Custom note");
});

test("parseSpecialString: multi-word names survive non-comma separators (space is not a separator)", () => {
    const { qualities, leftover } = parseSpecialString("Razor Sharp; Power Field\nTwin Linked");
    assert.deepEqual(qualities, [
        { key: "razorSharp", value: null },
        { key: "powerField", value: null },
        { key: "twinLinked", value: null }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: space-separated whole-string list is recognized (legacy whole-string parity)", () => {
    // The legacy regex parser matched each quality name ANYWHERE in the string,
    // so a space-separated list with no comma detected every trait. The primary
    // [,;\n] split makes "Accurate Tearing" one token; the second-pass in-token
    // scan must recover both qualities rather than silently dropping the traits.
    const { qualities, leftover } = parseSpecialString("Accurate Tearing");
    assert.deepEqual(qualities, [
        { key: "accurate", value: null },
        { key: "tearing", value: null }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: slash-separated whole-string list is recognized", () => {
    const { qualities, leftover } = parseSpecialString("Accurate / Tearing");
    assert.deepEqual(qualities, [
        { key: "accurate", value: null },
        { key: "tearing", value: null }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: 'and'-joined whole-string list recovers qualities (connector left over)", () => {
    const { qualities, leftover } = parseSpecialString("Storm and Tearing");
    assert.deepEqual(qualities, [
        { key: "storm", value: null },
        { key: "tearing", value: null }
    ]);
    // Trait recovery is the requirement; the bare connector "and" is cosmetic noise.
    assert.equal(leftover, "and");
});

test("parseSpecialString: in-token scan preserves encounter order, not config order", () => {
    // razorSharp precedes accurate in the config map; the second pass must order
    // by appearance in the token (accurate first here).
    const { qualities } = parseSpecialString("Accurate Razor Sharp");
    assert.deepEqual(qualities, [
        { key: "accurate", value: null },
        { key: "razorSharp", value: null }
    ]);
});

test("parseSpecialString: in-token scan has no Inaccurate -> accurate collision (no lookbehind)", () => {
    const { qualities } = parseSpecialString("Inaccurate Tearing");
    assert.deepEqual(qualities, [
        { key: "inaccurate", value: null },
        { key: "tearing", value: null }
    ]);
});

test("parseSpecialString: in-token scan recovers a parametric value", () => {
    const { qualities, leftover } = parseSpecialString("Tearing Proven (3)");
    assert.deepEqual(qualities, [
        { key: "tearing", value: null },
        { key: "proven", value: 3 }
    ]);
    assert.equal(leftover, "");
});

test("parseSpecialString: in-token scan still leaves genuine custom text as leftover", () => {
    const { qualities, leftover } = parseSpecialString("Tearing on a really cool sword");
    assert.deepEqual(qualities, [{ key: "tearing", value: null }]);
    assert.equal(leftover, "on a really cool sword");
});

test("parseSpecialString: all-custom text leaves leftover intact, no qualities", () => {
    const { qualities, leftover } = parseSpecialString("My homebrew quality");
    assert.deepEqual(qualities, []);
    assert.equal(leftover, "My homebrew quality");
});

test("parseSpecialString: idempotent on its own leftover (re-run finds nothing)", () => {
    const first = parseSpecialString("Inaccurate, Tearing, Custom note");
    const second = parseSpecialString(first.leftover);
    assert.deepEqual(second, { qualities: [], leftover: "Custom note" });
});

// ---------------------------------------------------------------------------
// buildTraitsFromQualities
// ---------------------------------------------------------------------------

test("buildTraitsFromQualities: empty input yields the full contract with falsy defaults", () => {
    const traits = buildTraitsFromQualities([]);
    assert.deepEqual(traits, {
        accurate: false,
        rfFace: undefined,
        proven: undefined,
        primitive: undefined,
        razorSharp: false,
        spray: false,
        skipAttackRoll: false,
        tearing: false,
        storm: false,
        twinLinked: false,
        force: false,
        inaccurate: false,
        lance: false,
        maximal: false,
        reliable: false,
        unreliable: false,
        overheats: false
    });
});

test("buildTraitsFromQualities: spray couples skipAttackRoll", () => {
    const traits = buildTraitsFromQualities([{ key: "spray", value: null }]);
    assert.equal(traits.spray, true);
    assert.equal(traits.skipAttackRoll, true);
});

test("buildTraitsFromQualities: parametric without value -> per-quality default", () => {
    const traits = buildTraitsFromQualities([
        { key: "vengeful", value: null },
        { key: "proven", value: null },
        { key: "primitive", value: null }
    ]);
    assert.equal(traits.rfFace, WEAPON_QUALITIES.vengeful.default);
    assert.equal(traits.proven, WEAPON_QUALITIES.proven.default);
    assert.equal(traits.primitive, WEAPON_QUALITIES.primitive.default);
    assert.equal(traits.rfFace, 9);
    assert.equal(traits.proven, 3);
    assert.equal(traits.primitive, 7);
});

test("buildTraitsFromQualities: parametric with explicit value uses that value", () => {
    const traits = buildTraitsFromQualities([{ key: "vengeful", value: 8 }]);
    assert.equal(traits.rfFace, 8);
});

test("buildTraitsFromQualities: absent parametric -> undefined (matches old parser)", () => {
    const traits = buildTraitsFromQualities([{ key: "tearing", value: null }]);
    assert.equal(traits.rfFace, undefined);
    assert.equal(traits.proven, undefined);
    assert.equal(traits.primitive, undefined);
});

test("buildTraitsFromQualities: new keys flip true when present", () => {
    for (const key of ["lance", "maximal", "reliable", "unreliable", "overheats"]) {
        const traits = buildTraitsFromQualities([{ key, value: null }]);
        assert.equal(traits[key], true, `${key} should be true when present`);
    }
});

test("buildTraitsFromQualities: tolerates undefined / non-array input", () => {
    assert.doesNotThrow(() => buildTraitsFromQualities(undefined));
    assert.equal(buildTraitsFromQualities(undefined).accurate, false);
});

// ---------------------------------------------------------------------------
// Parity with the legacy extractWeaponTraits (behavior-preservation proof)
// ---------------------------------------------------------------------------

// Shared keys both producers emit. The new builder additionally emits
// lance/maximal/reliable/unreliable/overheats, which the legacy parser lacks;
// comparing only the shared keys avoids a spurious full-deepEqual failure.
const SHARED_TRAIT_KEYS = [
    "accurate", "rfFace", "proven", "primitive", "razorSharp",
    "spray", "skipAttackRoll", "tearing", "storm", "twinLinked",
    "force", "inaccurate"
];

const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));

test("parity: structured pipeline matches legacy extractWeaponTraits on shared keys", () => {
    // Use explicit numeric values and no cross-token ambiguity: the legacy
    // greedy `.*` regex only behaves identically when each parametric quality
    // carries its own explicit single-digit (N). (A bare "Vengeful" would
    // legitimately diverge — old code leaves rfFace undefined, new code applies
    // the default 9; that divergence is the bug this feature fixes, not a
    // regression, so it is deliberately excluded from the parity fixture.)
    const legacyString = "Tearing, Razor-Sharp, Proven (3), Vengeful (9)";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

test("parity: spray/storm/twinLinked/force/inaccurate flags match legacy", () => {
    const legacyString = "Spray, Storm, Twin-Linked, Force, Inaccurate";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

test("parity: semicolon-separated string matches legacy whole-string detection", () => {
    // Non-parametric qualities only: the legacy parametric regexes are greedy
    // (/Vengeful.*\(\d\)/) and can grab a later token's digit across separators,
    // so parity for parametric qualities is only well-defined with comma-local
    // single-digit values. Flag qualities give a clean, discriminating check.
    const legacyString = "Accurate; Tearing";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

test("parity: newline-separated string matches legacy whole-string detection", () => {
    const legacyString = "Inaccurate\nStorm";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

// Separator-less whole-string lists (the blocker Codex flagged). Flag qualities
// only: the legacy greedy parametric regexes (/Vengeful.*\(\d\)/) diverge on
// separator-less input, so parametric parity is intentionally out of these
// fixtures (documented in the comma-separated parity tests above).
test("parity: space-separated 'Accurate Tearing' matches legacy whole-string detection", () => {
    const legacyString = "Accurate Tearing";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

test("parity: slash-separated 'Accurate / Tearing' matches legacy whole-string detection", () => {
    const legacyString = "Accurate / Tearing";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

test("parity: 'and'-joined 'Storm and Tearing' matches legacy whole-string detection", () => {
    const legacyString = "Storm and Tearing";
    const legacy = DarkHeresyUtil.extractWeaponTraits(legacyString);
    const built = buildTraitsFromQualities(parseSpecialString(legacyString).qualities);
    assert.deepEqual(pick(built, SHARED_TRAIT_KEYS), pick(legacy, SHARED_TRAIT_KEYS));
});

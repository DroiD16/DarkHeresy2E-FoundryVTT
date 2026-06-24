import { test } from "node:test";
import assert from "node:assert/strict";

// quality-parser.js imports only weapon-qualities.js, both pure/import-safe, so
// no Foundry stub is needed here.
import { parseSpecialToQualities, resolveFocusTestKey, dropQualitiesFromText } from "../script/common/quality-parser.js";
import { AMMUNITION_QUALITY_KEYS, PSYCHIC_POWER_QUALITY_KEYS } from "../script/common/weapon-qualities.js";

// ---------------------------------------------------------------------------
// parseSpecialToQualities
// ---------------------------------------------------------------------------

test("parses a mixed list of names, numbers, and spacing variants", () => {
    assert.deepEqual(
        parseSpecialToQualities("Accurate, Proven (3), Razor Sharp"),
        [
            { key: "accurate", value: null },
            { key: "proven", value: 3 },
            { key: "razorSharp", value: null }
        ]
    );
});

test("accepts label, hyphenated, and camelCase spellings of the same quality", () => {
    for (const text of ["Razor Sharp", "Razor-Sharp", "razorSharp", "RAZORSHARP"]) {
        assert.deepEqual(parseSpecialToQualities(text), [{ key: "razorSharp", value: null }], text);
    }
    assert.deepEqual(parseSpecialToQualities("Twin Linked"), [{ key: "twinLinked", value: null }]);
    assert.deepEqual(parseSpecialToQualities("Twin-Linked"), [{ key: "twinLinked", value: null }]);
    assert.deepEqual(parseSpecialToQualities("Power Field"), [{ key: "powerField", value: null }]);
});

test("extracts the numeric parameter in (N), (N) with space, and bare N forms", () => {
    assert.deepEqual(parseSpecialToQualities("Proven(3)"), [{ key: "proven", value: 3 }]);
    assert.deepEqual(parseSpecialToQualities("Proven (3)"), [{ key: "proven", value: 3 }]);
    assert.deepEqual(parseSpecialToQualities("Proven 3"), [{ key: "proven", value: 3 }]);
});

test("parametric quality with no number uses its per-quality default", () => {
    assert.deepEqual(parseSpecialToQualities("Primitive"), [{ key: "primitive", value: 7 }]);
    assert.deepEqual(parseSpecialToQualities("Vengeful"), [{ key: "vengeful", value: 9 }]);
    assert.deepEqual(parseSpecialToQualities("Blast"), [{ key: "blast", value: 1 }]);
});

test("non-parametric quality ignores a stray number and stores null", () => {
    assert.deepEqual(parseSpecialToQualities("Accurate (5)"), [{ key: "accurate", value: null }]);
});

test("'Inaccurate' resolves to inaccurate, not accurate (token-exact match)", () => {
    assert.deepEqual(parseSpecialToQualities("Inaccurate"), [{ key: "inaccurate", value: null }]);
    assert.deepEqual(parseSpecialToQualities("Accurate"), [{ key: "accurate", value: null }]);
});

test("unrecognized tokens are skipped (never invented)", () => {
    assert.deepEqual(
        parseSpecialToQualities("Accurate, Homebrew Note, Tearing"),
        [{ key: "accurate", value: null }, { key: "tearing", value: null }]
    );
    assert.deepEqual(parseSpecialToQualities("Totally Made Up"), []);
});

test("splits on commas, semicolons, slashes, line breaks, and 'and'", () => {
    assert.deepEqual(
        parseSpecialToQualities("Accurate; Tearing"),
        [{ key: "accurate", value: null }, { key: "tearing", value: null }]
    );
    assert.deepEqual(
        parseSpecialToQualities("Accurate / Tearing"),
        [{ key: "accurate", value: null }, { key: "tearing", value: null }]
    );
    assert.deepEqual(
        parseSpecialToQualities("Storm and Tearing"),
        [{ key: "storm", value: null }, { key: "tearing", value: null }]
    );
    assert.deepEqual(
        parseSpecialToQualities("Accurate\nProven (3)\nRazor Sharp"),
        [
            { key: "accurate", value: null },
            { key: "proven", value: 3 },
            { key: "razorSharp", value: null }
        ]
    );
    assert.deepEqual(
        parseSpecialToQualities("Tearing, Proven (3); Storm"),
        [
            { key: "tearing", value: null },
            { key: "proven", value: 3 },
            { key: "storm", value: null }
        ]
    );
});

// ---------------------------------------------------------------------------
// dropQualitiesFromText — render-time de-duplication (keeps custom remainder)
// ---------------------------------------------------------------------------

test("drops tokens already shown as chips, keeping genuinely-custom text", () => {
    assert.equal(dropQualitiesFromText("Accurate, custom text", ["accurate"]), "custom text");
    assert.equal(
        dropQualitiesFromText("Tearing, Reliable, my note", ["tearing", "reliable"]),
        "my note"
    );
});

test("keeps a quality token that is NOT in the present chip list", () => {
    // Tearing isn't chipped (e.g. a non-curated ammo quality) -> still displayed.
    assert.equal(dropQualitiesFromText("Tearing, custom", ["blast"]), "Tearing, custom");
});

test("dropQualitiesFromText: empty / all-stripped / non-string", () => {
    assert.equal(dropQualitiesFromText("Accurate", ["accurate"]), "");
    assert.equal(dropQualitiesFromText("", ["accurate"]), "");
    assert.equal(dropQualitiesFromText("   ", ["accurate"]), "");
    assert.equal(dropQualitiesFromText(null, ["accurate"]), "");
    assert.equal(dropQualitiesFromText("just prose here", []), "just prose here");
});

test("duplicate qualities are deduplicated (first occurrence wins)", () => {
    assert.deepEqual(
        parseSpecialToQualities("Proven (3), Proven (5)"),
        [{ key: "proven", value: 3 }]
    );
});

test("allowedKeys restricts emitted keys (ammunition curated set)", () => {
    assert.deepEqual(
        parseSpecialToQualities("Tearing, Toxic (4), Proven (3)", AMMUNITION_QUALITY_KEYS),
        [{ key: "tearing", value: null }, { key: "toxic", value: 4 }]
    );
});

test("allowedKeys restricts emitted keys (psychic curated set)", () => {
    assert.deepEqual(
        parseSpecialToQualities("Force, Hallucinogenic (2), Razor Sharp", PSYCHIC_POWER_QUALITY_KEYS),
        [{ key: "force", value: null }, { key: "hallucinogenic", value: 2 }]
    );
});

test("empty / non-string input returns an empty array", () => {
    assert.deepEqual(parseSpecialToQualities(""), []);
    assert.deepEqual(parseSpecialToQualities("   "), []);
    assert.deepEqual(parseSpecialToQualities(null), []);
    assert.deepEqual(parseSpecialToQualities(undefined), []);
    assert.deepEqual(parseSpecialToQualities(42), []);
});

// ---------------------------------------------------------------------------
// resolveFocusTestKey — locale-independent (hardcoded English labels), single arg.
// ---------------------------------------------------------------------------

test("returns null when the stored value is already a canonical key", () => {
    assert.equal(resolveFocusTestKey("willpower"), null);
    assert.equal(resolveFocusTestKey("commonLore"), null);
});

test("resolves an English label to its canonical key (any world locale)", () => {
    assert.equal(resolveFocusTestKey("Willpower"), "willpower");
    assert.equal(resolveFocusTestKey("Common Lore"), "commonLore");
    assert.equal(resolveFocusTestKey("Psyniscience"), "psyniscience");
    // A label that differs only in case from its key still resolves.
    assert.equal(resolveFocusTestKey("WILLPOWER"), "willpower");
});

test("resolves a characteristic short abbreviation (case-insensitive)", () => {
    assert.equal(resolveFocusTestKey("WP"), "willpower");
    assert.equal(resolveFocusTestKey("wp"), "willpower");
    assert.equal(resolveFocusTestKey("Per"), "perception");
    assert.equal(resolveFocusTestKey("BS"), "ballisticSkill");
});

test("returns null for empty or unresolvable values (runtime fallback handles those)", () => {
    assert.equal(resolveFocusTestKey(""), null);
    assert.equal(resolveFocusTestKey("   "), null);
    assert.equal(resolveFocusTestKey(null), null);
    assert.equal(resolveFocusTestKey(undefined), null);
    assert.equal(resolveFocusTestKey("Bananas"), null);
});

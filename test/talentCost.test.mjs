import { test } from "node:test";
import assert from "node:assert/strict";

// The pure helper has no Foundry dependencies, but talentData.js touches
// `foundry.data.fields` at module load. Stub minimally before importing.
globalThis.foundry = globalThis.foundry || {};
globalThis.foundry.abstract = globalThis.foundry.abstract
    || { TypeDataModel: class { static migrateData(source) { return source; } } };
globalThis.foundry.data = globalThis.foundry.data || {
    fields: {
        StringField: class { constructor(o = {}) { this.options = o; } },
        NumberField: class { constructor(o = {}) { this.options = o; } },
        BooleanField: class { constructor(o = {}) { this.options = o; } },
        ArrayField: class { constructor(el, o = {}) { this.element = el; this.options = o; } },
        SchemaField: class { constructor(f = {}, o = {}) { this.fields = f; this.options = o; } }
    }
};

const { computeTalentCost } = await import("../script/data/item/talentData.js");

// Distinct cells so [tier-1][2-matched] genuinely verifies the index math.
const COSTS = [
    [1, 2, 3], // tier 1: matched 2,1,0
    [4, 5, 6], // tier 2: matched 2,1,0
    [7, 8, 9]  // tier 3: matched 2,1,0
];

test("starter talent always costs 0", () => {
    assert.equal(
        computeTalentCost({ tier: 2, starter: true, aptitudes: "A,B" }, ["A", "B"], COSTS),
        0
    );
});

test("tier 0 costs 0 (out of 1..3 range)", () => {
    assert.equal(
        computeTalentCost({ tier: 0, starter: false, aptitudes: "A" }, ["A"], COSTS),
        0
    );
});

test("tier 4 (>3) costs 0", () => {
    assert.equal(
        computeTalentCost({ tier: 4, starter: false, aptitudes: "A" }, ["A"], COSTS),
        0
    );
});

test("tier 1, 0/1/2 matched aptitudes => talentCosts[0][2-matched]", () => {
    // 0 matched -> index 2
    assert.equal(computeTalentCost({ tier: 1, starter: false, aptitudes: "X" }, ["A"], COSTS), 3);
    // 1 matched -> index 1
    assert.equal(computeTalentCost({ tier: 1, starter: false, aptitudes: "A" }, ["A"], COSTS), 2);
    // 2 matched -> index 0
    assert.equal(computeTalentCost({ tier: 1, starter: false, aptitudes: "A,B" }, ["A", "B"], COSTS), 1);
});

test("tier 2, 0/1/2 matched aptitudes => talentCosts[1][2-matched]", () => {
    assert.equal(computeTalentCost({ tier: 2, starter: false, aptitudes: "X" }, ["A"], COSTS), 6);
    assert.equal(computeTalentCost({ tier: 2, starter: false, aptitudes: "A" }, ["A"], COSTS), 5);
    assert.equal(computeTalentCost({ tier: 2, starter: false, aptitudes: "A,B" }, ["A", "B"], COSTS), 4);
});

test("tier 3, 0/1/2 matched aptitudes => talentCosts[2][2-matched]", () => {
    assert.equal(computeTalentCost({ tier: 3, starter: false, aptitudes: "X" }, ["A"], COSTS), 9);
    assert.equal(computeTalentCost({ tier: 3, starter: false, aptitudes: "A" }, ["A"], COSTS), 8);
    assert.equal(computeTalentCost({ tier: 3, starter: false, aptitudes: "A,B" }, ["A", "B"], COSTS), 7);
});

test("aptitude string is split on ',' and trimmed", () => {
    // " A , B " -> ["A","B"]; both match -> 2 matched -> index 0
    assert.equal(
        computeTalentCost({ tier: 1, starter: false, aptitudes: " A , B " }, ["A", "B"], COSTS),
        1
    );
    // only one of the trimmed names matches -> 1 matched -> index 1
    assert.equal(
        computeTalentCost({ tier: 1, starter: false, aptitudes: " A , B " }, ["B"], COSTS),
        2
    );
});

test("string tier is parsed with parseInt", () => {
    assert.equal(
        computeTalentCost({ tier: "2", starter: false, aptitudes: "A" }, ["A"], COSTS),
        5
    );
});

test("empty aptitudes string => 0 matched", () => {
    // "".split(",") -> [""], which won't match a real aptitude name
    assert.equal(
        computeTalentCost({ tier: 1, starter: false, aptitudes: "" }, ["A", "General"], COSTS),
        3 // 0 matched -> index 2
    );
});

test("undefined aptitudes => 0 matched (no throw)", () => {
    assert.equal(
        computeTalentCost({ tier: 2, starter: false, aptitudes: undefined }, ["A"], COSTS),
        6 // 0 matched -> index 2 of tier 2 row
    );
});

test("structured array aptitudes are accepted (same as string)", () => {
    // 2 matched -> index 0
    assert.equal(
        computeTalentCost(
            { tier: 1, starter: false, aptitudes: [{ key: "A", value: null }, { key: "B", value: null }] },
            ["A", "B"],
            COSTS
        ),
        1
    );
    // 1 matched -> index 1
    assert.equal(
        computeTalentCost(
            { tier: 1, starter: false, aptitudes: [{ key: "A", value: null }, { key: "B", value: null }] },
            ["A"],
            COSTS
        ),
        2
    );
});

test("more than two matched aptitudes are capped at two (cap-at-two bug fix)", () => {
    // Three listed aptitudes, all matched. Without the cap, 2-matched=-1 would
    // index talentCosts[t-1][-1] -> undefined; the cap pins it to the 2-matched
    // tier (index 0), so the talent costs the same as matching exactly two.
    assert.equal(
        computeTalentCost(
            { tier: 1, starter: false, aptitudes: [{ key: "A" }, { key: "B" }, { key: "C" }] },
            ["A", "B", "C"],
            COSTS
        ),
        1 // index 0 == 2-matched tier, NOT undefined
    );
    assert.equal(
        computeTalentCost(
            { tier: 3, starter: false, aptitudes: "A, B, C, D" },
            ["A", "B", "C", "D", "General"],
            COSTS
        ),
        7 // tier 3, capped at 2 -> index 0
    );
});

test("duplicate matched aptitude is not double-counted", () => {
    // Character has only "A"; talent lists A twice. Distinct character aptitudes
    // are counted, so this is 1 matched (index 1), not 2.
    assert.equal(
        computeTalentCost(
            { tier: 1, starter: false, aptitudes: [{ key: "A" }, { key: "A" }] },
            ["A"],
            COSTS
        ),
        2
    );
});

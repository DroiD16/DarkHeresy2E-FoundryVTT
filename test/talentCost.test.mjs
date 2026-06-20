import { test } from "node:test";
import assert from "node:assert/strict";

// The pure helper has no Foundry dependencies, but talentData.js touches
// `foundry.data.fields` at module load. Stub minimally before importing.
globalThis.foundry = globalThis.foundry || {};
globalThis.foundry.abstract = globalThis.foundry.abstract || { TypeDataModel: class {} };
globalThis.foundry.data = globalThis.foundry.data || {
    fields: {
        StringField: class { constructor(o = {}) { this.options = o; } },
        NumberField: class { constructor(o = {}) { this.options = o; } },
        BooleanField: class { constructor(o = {}) { this.options = o; } }
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

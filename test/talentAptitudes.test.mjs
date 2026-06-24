import { test } from "node:test";
import assert from "node:assert/strict";

import { parseTalentAptitudes } from "../script/common/talent-aptitudes.js";

// talentData.js touches `foundry.data.fields` at module load and its
// migrateData chains to TypeDataModel.migrateData. Stub minimally before import.
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

const { default: TalentData } = await import("../script/data/item/talentData.js");

test("parseTalentAptitudes: comma string -> {key, value:null}[]", () => {
    assert.deepEqual(parseTalentAptitudes("Strength, Agility"), [
        { key: "Strength", value: null },
        { key: "Agility", value: null }
    ]);
});

test("parseTalentAptitudes: trims and drops blank segments", () => {
    assert.deepEqual(parseTalentAptitudes(" Strength ,  , Agility ,"), [
        { key: "Strength", value: null },
        { key: "Agility", value: null }
    ]);
});

test("parseTalentAptitudes: collapses duplicate keys (first wins)", () => {
    assert.deepEqual(parseTalentAptitudes("Strength, Strength, Agility"), [
        { key: "Strength", value: null },
        { key: "Agility", value: null }
    ]);
});

test("parseTalentAptitudes: passes through a structured array (idempotent)", () => {
    const structured = [{ key: "Strength", value: null }, { key: "Agility", value: null }];
    assert.deepEqual(parseTalentAptitudes(structured), structured);
});

test("parseTalentAptitudes: normalizes an array of bare strings", () => {
    assert.deepEqual(parseTalentAptitudes(["Strength", " Agility "]), [
        { key: "Strength", value: null },
        { key: "Agility", value: null }
    ]);
});

test("parseTalentAptitudes: drops array entries with blank/absent keys", () => {
    assert.deepEqual(parseTalentAptitudes([{ key: "Strength" }, { key: "" }, {}, { key: "  " }]), [
        { key: "Strength", value: null }
    ]);
});

test("parseTalentAptitudes: empty string / null / undefined -> []", () => {
    assert.deepEqual(parseTalentAptitudes(""), []);
    assert.deepEqual(parseTalentAptitudes(null), []);
    assert.deepEqual(parseTalentAptitudes(undefined), []);
    assert.deepEqual(parseTalentAptitudes([]), []);
});

test("TalentData.migrateData converts a legacy aptitudes string to the array shape", () => {
    const source = { aptitudes: "Strength, Agility" };
    const migrated = TalentData.migrateData(source);
    assert.deepEqual(migrated.aptitudes, [
        { key: "Strength", value: null },
        { key: "Agility", value: null }
    ]);
    // Mutates in place (Foundry contract) and returns the same source.
    assert.equal(migrated, source);
});

test("TalentData.migrateData leaves an already-structured array untouched", () => {
    const structured = [{ key: "Strength", value: null }];
    const source = { aptitudes: structured };
    const migrated = TalentData.migrateData(source);
    assert.equal(migrated.aptitudes, structured);
});

test("TalentData.migrateData tolerates a missing aptitudes field", () => {
    const source = {};
    const migrated = TalentData.migrateData(source);
    assert.equal("aptitudes" in migrated, false);
});

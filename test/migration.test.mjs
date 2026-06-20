import { test } from "node:test";
import assert from "node:assert/strict";

// `migrateCompendium` reads `foundry.utils.isEmpty`; provide a minimal stub
// before importing the module under test (it is captured at call time, not import
// time, but defining it up front keeps the global stable for all tests).
globalThis.foundry = globalThis.foundry || {
    utils: {
        isEmpty: obj => obj === null || obj === undefined || Object.keys(obj).length === 0
    }
};

import {
    buildActorMigrationUpdate,
    legacyAptitudeItems,
    migrateCompendium
} from "../script/common/migration.js";

/**
 * Build a minimal acolyte/npc `system` fixture covering the fields the pure
 * migration steps read. Callers override as needed.
 * @param {object} overrides Partial system data merged over the defaults.
 * @returns {object} A plain `system` object (no Foundry document wrapping).
 */
function makeSystem(overrides = {}) {
    return {
        skills: {
            psyniscience: {
                label: "Psyniscience",
                characteristics: ["WP"],
                advance: 0
            },
            forbiddenLore: {
                label: "Forbidden Lore",
                specialities: {
                    archeotech: {label: "Archeotech", isKnown: false, advance: -20, total: 0, cost: 0}
                }
            }
        },
        characteristics: {
            intelligence: {
                base: {total: 30}
            }
        },
        ...overrides
    };
}

test("pre-v1 acolyte: psyniscience characteristics set", () => {
    const update = buildActorMigrationUpdate("acolyte", makeSystem(), 0);
    assert.deepEqual(update["system.skills.psyniscience"].characteristics, ["Per", "WP"]);
    // Existing fields preserved (non-mutating merge).
    assert.equal(update["system.skills.psyniscience"].label, "Psyniscience");
});

test("pre-v1 acolyte: forbiddenLore specialities added with preserved arithmetic", () => {
    const update = buildActorMigrationUpdate("acolyte", makeSystem(), 0);
    const fl = update["system.skills.forbiddenLore"];
    assert.ok(fl, "forbiddenLore update present");
    const specs = fl.specialities;
    // Pre-existing speciality preserved.
    assert.ok(specs.archeotech, "existing speciality preserved");
    // New specialities present.
    for (const key of ["officioAssassinorum", "pirates", "psykers", "theWarp", "xenos"]) {
        assert.ok(specs[key], `speciality ${key} present`);
        assert.equal(specs[key].advance, -20);
        // base.total (30) + advance (-20) = 10, preserving the odd `.base.total` read.
        assert.equal(specs[key].total, 10);
        assert.equal(specs[key].isKnown, false);
        assert.equal(specs[key].cost, 0);
    }
    assert.equal(specs.officioAssassinorum.label, "Officio Assassinorum");
});

test("pre-v1 acolyte: aptitude deletion flag set", () => {
    const update = buildActorMigrationUpdate("acolyte", makeSystem(), 0);
    assert.ok("system.-=aptitudes" in update);
    assert.equal(update["system.-=aptitudes"], null);
});

test("pre-v1: aptitude items computed from legacy text aptitudes", () => {
    const system = makeSystem({
        aptitudes: {
            a1: {id: "a1", name: "Weapon Skill"},
            a2: {id: "a2", name: "Toughness"}
        }
    });
    const items = legacyAptitudeItems(system);
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], {
        name: "Weapon Skill",
        type: "aptitude",
        isAptitude: true,
        img: "systems/dark-heresy/asset/icons/aptitudes/aptitude400.png"
    });
    assert.equal(items[1].name, "Toughness");
});

test("pre-v1 npc: bio.notes migrated to notes", () => {
    const system = makeSystem({bio: {notes: "Cunning xenos hybrid"}});
    const update = buildActorMigrationUpdate("npc", system, 0);
    assert.equal(update["system.notes"], "Cunning xenos hybrid");
});

test("partially-migrated actor (fromVersion 3): only pending steps apply", () => {
    const system = makeSystem({bio: {notes: "older notes"}});
    const update = buildActorMigrationUpdate("npc", system, 3);
    // < 1 and < 2 already done: must NOT be present.
    assert.ok(!("system.skills.psyniscience" in update), "psyniscience not re-applied");
    assert.ok(!("system.skills.forbiddenLore" in update), "forbiddenLore not re-applied");
    // < 4 deletion flag still pending.
    assert.ok("system.-=aptitudes" in update, "aptitude flag still applied");
    // < 6 npc notes still pending.
    assert.equal(update["system.notes"], "older notes");
});

test("already-at-6 actor: buildActorMigrationUpdate returns empty object", () => {
    const update = buildActorMigrationUpdate("acolyte", makeSystem(), 6);
    assert.deepEqual(update, {});
});

test("already-at-6 npc with bio.notes: still nothing pending", () => {
    const system = makeSystem({bio: {notes: "anything"}});
    const update = buildActorMigrationUpdate("npc", system, 6);
    assert.deepEqual(update, {});
});

test("legacyAptitudeItems: no legacy aptitudes returns empty array", () => {
    assert.deepEqual(legacyAptitudeItems(makeSystem()), []);
    assert.deepEqual(legacyAptitudeItems({}), []);
    assert.deepEqual(legacyAptitudeItems({aptitudes: null}), []);
    assert.deepEqual(legacyAptitudeItems(undefined), []);
});

test("legacyAptitudeItems: filters out entries with missing/blank/non-string names or no id", () => {
    const system = makeSystem({
        aptitudes: {
            good: {id: "good", name: "Intelligence"},
            blank: {id: "blank", name: "   "},
            empty: {id: "empty", name: ""},
            nullName: {id: "nullName", name: null},
            undefName: {id: "undefName"},
            numName: {id: "numName", name: 42},
            noId: {name: "NoIdAptitude"}
        }
    });
    const items = legacyAptitudeItems(system);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "Intelligence");
});

test("non-acolyte/npc type: pure update is empty for version-gated steps", () => {
    // A type other than acolyte/npc skips < 1, < 2, < 4 and (for < 6) the npc-only step.
    const update = buildActorMigrationUpdate("vehicle", makeSystem({bio: {notes: "x"}}), 0);
    assert.deepEqual(update, {});
});

/**
 * Build a mock compendium pack of Actor documents that records the order of
 * `createEmbeddedDocuments` and `update` calls into a shared log.
 * @param {object[]} docDefs Per-doc definitions: {type, system}.
 * @param {object[]} log Shared call-order log to append to.
 * @returns {object} A minimal pack stub with metadata.type === "Actor".
 */
function makeActorPack(docDefs, log) {
    const documents = docDefs.map((def, i) => ({
        type: def.type,
        system: def.system,
        // migrateActor calls prepareData() for the derived steps (< 3, < 5).
        prepareData() {},
        async createEmbeddedDocuments(embeddedType, data) {
            log.push({doc: i, op: "createEmbeddedDocuments", embeddedType, data});
        },
        async update(update) {
            log.push({doc: i, op: "update", update});
        }
    }));
    return {
        metadata: {type: "Actor"},
        async migrate() {
            log.push({op: "migrate"});
            return this;
        },
        async getDocuments() {
            return documents;
        }
    };
}

test("migrateCompendium: pre-v4 acolyte migrates pack, recreates aptitude items BEFORE deletion", async () => {
    const log = [];
    const pack = makeActorPack([{
        type: "acolyte",
        system: makeSystem({aptitudes: {a1: {id: "a1", name: "Weapon Skill"}}})
    }], log);

    await migrateCompendium(pack, 0);

    // pack.migrate() runs first, before any document work.
    assert.equal(log[0].op, "migrate", "pack.migrate runs before reading documents");

    const create = log.find(e => e.op === "createEmbeddedDocuments");
    const update = log.find(e => e.op === "update");
    assert.ok(create, "aptitude items created");
    assert.equal(create.embeddedType, "Item");
    assert.equal(create.data.length, 1);
    assert.equal(create.data[0].name, "Weapon Skill");
    assert.equal(create.data[0].type, "aptitude");

    // Create must precede the update that carries the deletion flag.
    assert.ok(log.indexOf(create) < log.indexOf(update), "create runs before update");
    assert.ok(update, "an update is applied");
    // Assert only the keys we care about; the update also carries derived
    // armour (< 3) and experience (< 5) keys, which is expected.
    assert.equal(update.update["system.-=aptitudes"], null,
        "deletion flag carried by the post-create update");
    assert.ok("system.experience.value" in update.update,
        "derived experience step (< 5) applied for compendium actors");
});

test("migrateCompendium: at-version-5 acolyte is a true no-op (migrate still runs)", async () => {
    // fromVersion 5: >= 4 (no aptitude work), >= 5 (no experience step),
    // >= 3 (no armour step), not npc (no < 6). Nothing should change on the doc.
    const log = [];
    const pack = makeActorPack([{
        type: "acolyte",
        system: makeSystem({aptitudes: {a1: {id: "a1", name: "Weapon Skill"}}})
    }], log);

    await migrateCompendium(pack, 5);

    assert.ok(log.some(e => e.op === "migrate"), "pack.migrate is still invoked");
    assert.ok(!log.some(e => e.op === "createEmbeddedDocuments"),
        "no aptitude items created at version 5");
    assert.ok(!log.some(e => e.op === "update"),
        "no update when no migration step applies");
});

test("migrateCompendium: Actor pack invokes pack.migrate()", async () => {
    const log = [];
    const pack = makeActorPack([{type: "acolyte", system: makeSystem()}], log);
    await migrateCompendium(pack, 0);
    assert.ok(log.some(e => e.op === "migrate"), "pack.migrate is invoked for Actor packs");
});

test("migrateCompendium: non-Actor pack is a no-op (no migrate, no getDocuments)", async () => {
    const log = [];
    const pack = {
        metadata: {type: "Item"},
        async migrate() {
            log.push({op: "migrate"});
            return this;
        },
        async getDocuments() {
            log.push({op: "getDocuments"});
            return [];
        }
    };
    await migrateCompendium(pack, 0);
    assert.equal(log.length, 0,
        "non-Actor pack short-circuits before calling migrate or reading documents");
});

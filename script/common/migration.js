import { parseSpecialToQualities, resolveFocusTestKey } from "./quality-parser.js";
import { AMMUNITION_QUALITY_KEYS } from "./weapon-qualities.js";
import { parseTalentAptitudes } from "./talent-aptitudes.js";

/**
 * Run the world migration if the stored schema version is behind the target.
 *
 * Per-actor (and per-compendium) failures are isolated, logged with the offending
 * document's name/id, and surfaced to the GM via `ui.notifications.error`, but the
 * world version is still advanced at the end of the run. This follows the standard
 * Foundry migration convention and is deliberate: these steps are NOT idempotent
 * (re-running step `< 5` would re-add `totalspent` to experience, etc.), so the
 * version must advance to avoid re-corrupting already-migrated healthy actors on the
 * next load. The original bug was never the unconditional bump itself — it was that
 * per-actor errors were swallowed silently; they are now reported.
 *
 * Schema version 7 adds a one-time ITEM migration (`migrateItems`) covering world
 * items, actor-embedded items (live actors and world Actor compendiums), and
 * world Item compendiums: it persists the
 * legacy weapon `ammo` link (array -> single id), seeds structured
 * `specialQualities` from the decorative free-text `special` fields, normalizes a
 * free-text psychic `focusPower.test` to its canonical key, and converts the
 * legacy comma-separated talent `aptitudes` string to the structured aptitude
 * list. It is idempotent — it only seeds qualities when none exist yet, so curated
 * chips are never duplicated or resurrected, and the talent conversion normalizes
 * either shape. The free-text fields are left intact. The read-time `migrateData`
 * shims (rateOfFire/damageModifier/ammo and the talent aptitudes shim) stay in
 * place as a safety net for imported or compendium documents the runner cannot
 * reach.
 *
 * KNOWN LIMITATION: Worlds that were already sealed at worldSchemaVersion = 6 by the
 * previously-broken build will not re-run these migrations (nor will an actor that
 * threw during this run get a second attempt, since the version still advances). A
 * safe, re-runnable re-baseline is deferred to the future unified migration runner.
 * We deliberately do NOT attempt auto-remediation here because these steps are not
 * idempotent: re-running them would duplicate aptitude items and forbiddenLore
 * specialities and double-count experience.
 * @returns {Promise<void>}
 */
export const migrateWorld = async () => {
    const schemaVersion = 7;
    const worldSchemaVersion = Number(game.settings.get("dark-heresy", "worldSchemaVersion"));
    if (worldSchemaVersion !== schemaVersion && game.user.isGM) {
        ui.notifications.info("Upgrading the world, please wait...");
        let failed = false;
        for (let actor of game.actors.contents) {
            try {
                const update = await migrateActor(actor, worldSchemaVersion);
                if (!foundry.utils.isEmpty(update)) {
                    await actor.update(update, {enforceTypes: false});
                }
            } catch(e) {
                failed = true;
                console.error(`dark-heresy | Failed to migrate actor "${actor?.name}" (${actor?.id}):`, e);
            }
        }
        for (let pack of
            game.packs.filter(p => p.metadata.package === "world" && ["Actor"].includes(p.metadata.type))) {
            try {
                await migrateCompendium(pack, worldSchemaVersion);
            } catch(e) {
                failed = true;
                console.error(`dark-heresy | Failed to migrate compendium "${pack?.metadata?.id}":`, e);
            }
        }
        if (worldSchemaVersion < 7) {
            try {
                if (await migrateItems()) failed = true;
            } catch(e) {
                failed = true;
                console.error("dark-heresy | Failed to migrate items:", e);
            }
        }
        await game.settings.set("dark-heresy", "worldSchemaVersion", schemaVersion);
        if (failed) {
            ui.notifications.error(
                "World upgrade finished with errors: one or more actors could not be migrated and may "
                + "need manual attention. See the console for details.");
        } else {
            ui.notifications.info("Upgrade complete!");
        }
    }
};

/**
 * Build the plain `update` delta object for an actor migration.
 *
 * This is a PURE function: it only reads its arguments and must NOT reference
 * `game`, `ui`, `foundry`, `CONFIG`, or any live document method. It covers the
 * data-only migration steps:
 *  - `< 1` psyniscience characteristics
 *  - `< 2` forbiddenLore specialities
 *  - `< 4` the `system.-=aptitudes` deletion flag
 *  - `< 6` npc bio.notes -> notes
 *
 * Steps `< 3` (derived armour) and `< 5` (derived experience) are intentionally
 * excluded because they depend on `actor.prepareData()` and derived data; they are
 * handled by the orchestrator and exercised at the integration level.
 * @param {string} type The actor type (e.g. "acolyte", "npc").
 * @param {object} system The actor `system` source data.
 * @param {number} fromVersion The schema version the actor is migrating from.
 * @returns {object} The update delta (empty object when nothing applies).
 */
export const buildActorMigrationUpdate = (type, system, fromVersion) => {
    const update = {};
    const isAcolyteOrNpc = type === "acolyte" || type === "npc";

    if (fromVersion < 1) {
        if (isAcolyteOrNpc) {
            update["system.skills.psyniscience"] = {
                ...system.skills.psyniscience,
                characteristics: ["Per", "WP"]
            };
        }
    }

    if (fromVersion < 2) {
        if (isAcolyteOrNpc) {
            // Preserve the original (odd) arithmetic verbatim: it reads `.base.total`.
            let characteristic = system.characteristics.intelligence.base;
            let advance = -20;
            let total = characteristic.total + advance;

            let forbiddenLore = {
                ...system.skills.forbiddenLore,
                specialities: {
                    ...system.skills.forbiddenLore.specialities,
                    officioAssassinorum: {
                        label: "Officio Assassinorum",
                        isKnown: false,
                        advance: advance,
                        total: total,
                        cost: 0
                    },
                    pirates: {
                        label: "Pirates",
                        isKnown: false,
                        advance: advance,
                        total: total,
                        cost: 0
                    },
                    psykers: {
                        label: "Psykers",
                        isKnown: false,
                        advance: advance,
                        total: total,
                        cost: 0
                    },
                    theWarp: {
                        label: "The Warp",
                        isKnown: false,
                        advance: advance,
                        total: total,
                        cost: 0
                    },
                    xenos: {
                        label: "Xenos",
                        isKnown: false,
                        advance: advance,
                        total: total,
                        cost: 0
                    }
                }
            };
            update["system.skills.forbiddenLore"] = forbiddenLore;
        }
    }

    // Migrate aptitudes: delete the legacy text aptitudes (the item creation is the
    // side-effectful part handled by the orchestrator via legacyAptitudeItems).
    if (fromVersion < 4) {
        if (isAcolyteOrNpc) {
            update["system.-=aptitudes"] = null;
        }
    }

    if (fromVersion < 6) {
        if (type === "npc") {
            if (system.bio?.notes) {
                update["system.notes"] = system.bio.notes;
            }
        }
    }

    return update;
};

/**
 * Compute the aptitude item-creation data from an actor's legacy text aptitudes.
 *
 * This is a PURE function: it only reads its argument and must NOT reference
 * `game`, `ui`, `foundry`, `CONFIG`, or any live document method. It is the pure
 * part of the `< 4` migration step; the orchestrator passes the result to
 * `actor.createEmbeddedDocuments`.
 *
 * It preserves the original guards, filtering out aptitude entries that lack an
 * `id`, or have a missing / blank / non-string `name`.
 * @param {object} system The actor `system` source data.
 * @returns {object[]} Item creation data; empty when there are no legacy aptitudes.
 */
export const legacyAptitudeItems = system => {
    let textAptitudes = system?.aptitudes;
    if (textAptitudes === null || textAptitudes === undefined) {
        return [];
    }
    return Object.values(textAptitudes)
        // Be extra careful and filter out bad data because the existing data is bugged
        .filter(textAptitude =>
            "id" in textAptitude
            && textAptitude?.name !== null
            && textAptitude?.name !== undefined
            && typeof textAptitude?.name === "string"
            && 0 !== textAptitude?.name?.trim().length)
        .map(textAptitude => {
            return {
                name: textAptitude.name,
                type: "aptitude",
                isAptitude: true,
                img: "systems/dark-heresy/asset/icons/aptitudes/aptitude400.png"
            };
        });
};

/**
 * Orchestrate a single actor migration, combining the pure data transforms with the
 * side-effectful steps (prepareData, derived-data reads, embedded item creation).
 * @param {Actor} actor The actor document to migrate.
 * @param {number} fromVersion The schema version the actor is migrating from.
 * @returns {Promise<object>} The update delta to apply to the actor.
 */
const migrateActor = async (actor, fromVersion) => {
    const update = buildActorMigrationUpdate(actor.type, actor.system, fromVersion);

    // Step < 4 (side-effectful part): create aptitude items from legacy text data.
    if (fromVersion < 4 && (actor.type === "acolyte" || actor.type === "npc")) {
        const aptitudeItemsData = legacyAptitudeItems(actor.system);
        if (aptitudeItemsData.length > 0) {
            await actor.createEmbeddedDocuments("Item", aptitudeItemsData);
        }
    }

    // Step < 3: derived armour requires prepareData.
    if (fromVersion < 3) {
        actor.prepareData();
        update["system.armour"] = actor.system.armour;
    }

    // Step < 5: derived experience requires prepareData.
    if (fromVersion < 5) {
        actor.prepareData();
        let experience = actor.system?.experience;
        let value = (experience?.value || 0) + (experience?.totalspent || 0);
        // In case of an Error in the calculation don't do anything: losing data is worse
        // than doing nothing in this case since the user can easily do this himself.
        if (!isNaN(value) && value !== undefined) {
            update["system.experience.value"] = value;
        }
    }

    return update;
};

/**
 * Migrate Data in Compendiums.
 *
 * Non-Actor packs are a full no-op (no `pack.migrate()`, no document reads).
 * For Actor packs this first calls `pack.migrate()` to re-save every document
 * with the current data model and system template, then reuses the per-actor
 * orchestrator (`migrateActor`) so compendium actors receive the SAME migration
 * as world actors — including the derived armour (< 3) and experience (< 5)
 * steps and the side-effectful aptitude item creation (< 4).
 * @param {CompendiumCollection} pack The compendium pack to migrate.
 * @param {number} worldSchemaVersion The schema version being migrated from.
 * @returns {Promise<void>}
 */
export const migrateCompendium = async function(pack, worldSchemaVersion) {
    const entity = pack.metadata.type;
    if (entity !== "Actor") {
        return;
    }

    await pack.migrate();

    const documents = await pack.getDocuments();
    for (let doc of documents) {
        const update = await migrateActor(doc, worldSchemaVersion);
        if (!foundry.utils.isEmpty(update)) {
            await doc.update(update);
        }
    }
};

/**
 * Build the plain `update` delta for one item's schema-7 migration.
 *
 * This is a PURE function: it reads only its arguments and must NOT reference
 * `game`, `ui`, `foundry`, `CONFIG`, or any live document method. `resolveFocus`
 * is injected (it maps a free-text `focusPower.test` to its canonical key, or
 * returns null for "leave unchanged") so the function stays unit-testable.
 *
 * It covers, by item type:
 *  - weapon:        persist a non-empty `ammo` link (legacy single-element array
 *                   already presented as a string by the read shim); seed
 *                   `specialQualities` from free-text `special` when none exist.
 *  - ammunition:    seed `effect.specialQualities` from `effect.special`.
 *  - psychicPower:  seed `damage.specialQualities` from `damage.special`; resolve
 *                   `focusPower.test` to a canonical key when it is free text.
 *  - talent:        convert the legacy comma-separated `aptitudes` string to the
 *                   structured `{key, value}` list (normalizing either shape).
 *
 * Quality seeding is skipped when the target already has qualities, so curated
 * chips are never duplicated or resurrected and the migration is idempotent. The
 * free-text fields themselves are left intact (decorative).
 * @param {string} type                       The item type (e.g. "weapon").
 * @param {object} system                     The item `system` source data.
 * @param {(test: string) => (string|null)} [resolveFocus] Focus-test resolver.
 * @returns {object} The update delta (empty object when nothing applies).
 */
export const buildItemMigrationUpdate = (type, system, resolveFocus = () => null) => {
    const update = {};
    if (!system) return update;

    if (type === "weapon") {
        if (typeof system.ammo === "string" && system.ammo !== "") {
            update["system.ammo"] = system.ammo;
        }
        addParsedQualities(update, "system.specialQualities", system.specialQualities, system.special, null);
    } else if (type === "ammunition") {
        addParsedQualities(update, "system.effect.specialQualities",
            system.effect?.specialQualities, system.effect?.special, AMMUNITION_QUALITY_KEYS);
    } else if (type === "psychicPower") {
        // Parse the FULL quality set (allowedKeys = null), not just the curated
        // add-dropdown subset: the legacy runtime parsed psychic `damage.special`
        // with the full weapon-trait parser (e.g. Tearing/Proven were automated on
        // psychic damage), so restricting here would silently drop those mechanics.
        // The curated subset still governs only what the sheet OFFERS to add.
        addParsedQualities(update, "system.damage.specialQualities",
            system.damage?.specialQualities, system.damage?.special, null);
        const key = resolveFocus(system.focusPower?.test);
        if (key) update["system.focusPower.test"] = key;
    } else if (type === "talent") {
        // Convert the legacy comma-separated aptitude string to the structured
        // list. `system.aptitudes` may already be the array (the TalentData
        // read-shim runs before this and on documents created in the new schema),
        // so parseTalentAptitudes normalizes either shape and the conversion is
        // idempotent. Empty results are skipped so talents with no aptitudes are
        // not rewritten.
        const aptitudes = parseTalentAptitudes(system.aptitudes);
        if (aptitudes.length > 0) update["system.aptitudes"] = aptitudes;
    }
    return update;
};

/**
 * Add a parsed-qualities entry to `update[path]` only when the target has no
 * qualities yet (preserving any user-curated chips) and the free text yields at
 * least one recognized quality.
 * @param {object} update            The update delta being built (mutated).
 * @param {string} path              Flattened target path (e.g. "system.specialQualities").
 * @param {unknown} existing         The current stored qualities array.
 * @param {string} freeText          The decorative free-text source.
 * @param {string[]|null} allowedKeys Permitted quality keys, or null for all.
 */
const addParsedQualities = (update, path, existing, freeText, allowedKeys) => {
    if (Array.isArray(existing) && existing.length > 0) return;
    const parsed = parseSpecialToQualities(freeText, allowedKeys);
    if (parsed.length > 0) update[path] = parsed;
};

/**
 * Build the flattened migration delta (no `_id`) for a single item document.
 * @param {Item} doc The item document.
 * @returns {object} The delta (empty when nothing applies).
 */
const buildItemDelta = doc =>
    buildItemMigrationUpdate(doc.type, doc.toObject().system, resolveFocusTestKey);

/**
 * Build the `{_id, ...delta}` update for a single item document (for batch
 * collection updates), or null when nothing applies.
 * @param {Item} doc The item document.
 * @returns {object|null}
 */
const buildItemUpdate = doc => {
    const delta = buildItemDelta(doc);
    if (foundry.utils.isEmpty(delta)) return null;
    return { _id: doc.id, ...delta };
};

/**
 * Collect schema-7 update deltas for a list of item documents.
 * @param {Iterable<Item>} items The item documents.
 * @returns {object[]} The `{_id, ...delta}` updates (empty when nothing applies).
 */
const collectItemUpdates = items => {
    const updates = [];
    for (const item of items) {
        const update = buildItemUpdate(item);
        if (update) updates.push(update);
    }
    return updates;
};

/**
 * Apply the schema-7 migration to one actor's embedded items.
 * @param {Actor} actor The owning actor.
 * @returns {Promise<void>}
 */
const migrateEmbeddedItems = async actor => {
    const updates = collectItemUpdates(actor.items.contents);
    if (updates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", updates, { diff: false, render: false });
    }
};

/**
 * One-time (schema-7) item migration over world items, actor-embedded items
 * (live actors AND world Actor compendiums), and world Item compendiums.
 *
 * Updates are applied with `{diff: false}` so the cleaned shape is written to the
 * database even when it already matches the (read-shim migrated) in-memory
 * source — otherwise the persisted legacy shape would never be rewritten.
 *
 * Failures are isolated per collection/document and logged, so one bad document
 * never skips the rest of the run. The schema version still advances afterward
 * (it is shared with the non-idempotent actor steps and must not be left behind);
 * the item steps ARE idempotent, so at worst a transiently-failed document keeps
 * relying on the read-time shims until it is next edited.
 * @returns {Promise<boolean>} Whether any isolated failure occurred.
 */
const migrateItems = async () => {
    let failed = false;
    const guard = async (label, fn) => {
        try {
            await fn();
        } catch(e) {
            failed = true;
            console.error(`dark-heresy | Item migration failed (${label}):`, e);
        }
    };
    const worldPacks = type =>
        game.packs.filter(p => p.metadata.package === "world" && p.metadata.type === type);

    // World items.
    await guard("world items", async () => {
        const updates = collectItemUpdates(game.items.contents);
        if (updates.length > 0) {
            await game.items.documentClass.updateDocuments(updates, { diff: false, render: false });
        }
    });

    // Actor-embedded items on live world actors.
    for (const actor of game.actors.contents) {
        await guard(`actor "${actor?.name}" (${actor?.id})`, () => migrateEmbeddedItems(actor));
    }

    // Embedded items inside world Actor compendiums.
    for (const pack of worldPacks("Actor")) {
        await guard(`actor compendium "${pack?.metadata?.id}"`, async () => {
            for (const actor of await pack.getDocuments()) {
                await guard(`compendium actor "${actor?.name}" (${actor?.id})`,
                    () => migrateEmbeddedItems(actor));
            }
        });
    }

    // World Item compendiums.
    for (const pack of worldPacks("Item")) {
        await guard(`item compendium "${pack?.metadata?.id}"`, async () => {
            await pack.migrate();
            for (const doc of await pack.getDocuments()) {
                await guard(`compendium item "${doc?.name}" (${doc?.id})`, async () => {
                    const delta = buildItemDelta(doc);
                    if (!foundry.utils.isEmpty(delta)) {
                        await doc.update(delta, { diff: false });
                    }
                });
            }
        });
    }

    return failed;
};

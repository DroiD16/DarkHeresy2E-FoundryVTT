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
    const schemaVersion = 6;
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

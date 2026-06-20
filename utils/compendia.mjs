import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import {ClassicLevel} from "classic-level";

const PACK_SRC = "./src/packs";
const PACK_DEST = "./packs";

/**
 * LevelDB key/value encodings used by Foundry's compendium packs. These match
 * Foundry's native pack format so the output is read directly by Foundry VTT 13.
 * @type {{keyEncoding: string, valueEncoding: string}}
 */
const LEVELDB_OPTIONS = {keyEncoding: "utf8", valueEncoding: "json"};

/**
 * Map a source document `type` to the LevelDB collection name used in pack keys.
 * Aptitudes are an Item subtype, so they live in the `items` collection. This
 * mirrors Foundry's own pack key collection naming; extend it if a pack of
 * non-Item documents is ever added under {@link PACK_SRC}.
 * @type {Record<string, string>}
 */
const TYPE_COLLECTION_MAP = {
    aptitude: "items"
};

/**
 * Find YAML source files recursively.
 * @param {string} directory The directory to search.
 * @returns {string[]} Absolute-or-relative paths to every `.yaml` file found.
 */
function findYamlFiles(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return findYamlFiles(entryPath);
        return entry.name.endsWith(".yaml") ? [entryPath] : [];
    });
}

/**
 * Compact a ClassicLevel database between its first and last keys so the pack is
 * stored as `.ldb` table files rather than only an open `.log`, matching how
 * Foundry stores built packs. A no-op for an empty database.
 * @param {ClassicLevel} db The database to compact.
 * @returns {Promise<void>}
 */
async function compactClassicLevel(db) {
    const [firstKey] = await db.keys({limit: 1, fillCache: false}).all();
    const [lastKey] = await db.keys({limit: 1, reverse: true, fillCache: false}).all();
    if (firstKey && lastKey) await db.compactRange(firstKey, lastKey, {keyEncoding: "utf8"});
}

/**
 * Compile a single source folder of multi-document YAML into a LevelDB
 * compendium pack directory.
 *
 * Our source is a single multi-document YAML file (`aptitudes.yaml` holds 19
 * `---`-separated documents and no `_key`), so we parse it ourselves and write
 * directly to LevelDB via `classic-level`, reproducing Foundry's native pack
 * format: the `!items!<_id>` key scheme for `type: "Item"` packs and the
 * `{keyEncoding: "utf8", valueEncoding: "json"}` encodings Foundry reads. The
 * pack identity lives only in the LevelDB key; the stored value carries no
 * `_key` field, matching Foundry's built packs.
 * @param {string} folder The source folder name under {@link PACK_SRC}.
 * @returns {Promise<void>}
 */
async function compileFolder(folder) {
    const documents = findYamlFiles(path.join(PACK_SRC, folder)).flatMap(file => {
        return yaml.loadAll(fs.readFileSync(file, "utf8")).filter(Boolean);
    });

    const dest = path.join(PACK_DEST, folder);

    // Remove any existing pack directory so stale keys from removed source
    // documents cannot survive a rebuild; a LevelDB directory does not
    // self-clean the way unlinking a single-file database would.
    fs.rmSync(dest, {recursive: true, force: true});
    fs.mkdirSync(dest, {recursive: true});

    const db = new ClassicLevel(dest, LEVELDB_OPTIONS);
    try {
        const batch = db.batch();
        const seenKeys = new Set();
        for (const document of documents) {
            const collection = TYPE_COLLECTION_MAP[document.type];
            if (!collection) {
                throw new Error(`No collection mapping for document type '${document.type}' in folder '${folder}'.`);
            }
            const key = `!${collection}!${document._id}`;
            if (seenKeys.has(key)) {
                throw new Error(`Duplicate pack key '${key}' in source folder '${folder}'.`);
            }
            seenKeys.add(key);
            batch.put(key, document);
        }
        await batch.write();
        await compactClassicLevel(db);
    } finally {
        await db.close();
    }
}

/**
 * Generate LevelDB compendium pack directories from YAML sources. Each folder
 * under {@link PACK_SRC} becomes a `./packs/<folder>/` LevelDB directory.
 * @returns {Promise<void>}
 */
async function buildPacks() {
    const folders = fs.readdirSync(PACK_SRC).filter(file => {
        return fs.statSync(path.join(PACK_SRC, file)).isDirectory();
    });

    fs.mkdirSync(PACK_DEST, {recursive: true});

    await Promise.all(folders.map(folder => compileFolder(folder)));
}

export const compile = buildPacks;

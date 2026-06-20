import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const PACK_SRC = "./src/packs";
const PACK_DEST = "./packs";

/**
 * Find YAML source files recursively.
 * @param {string} directory
 * @returns {string[]}
 */
function findYamlFiles(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return findYamlFiles(entryPath);
        return entry.name.endsWith(".yaml") ? [entryPath] : [];
    });
}

/**
 * Generate NeDB compendium files from YAML templates.
 * @returns {Promise<void>}
 */
async function buildPacks() {
    const folders = fs.readdirSync(PACK_SRC).filter(file => {
        return fs.statSync(path.join(PACK_SRC, file)).isDirectory();
    });

    fs.mkdirSync(PACK_DEST, {recursive: true});

    await Promise.all(folders.map(async folder => {
        const documents = findYamlFiles(path.join(PACK_SRC, folder)).flatMap(file => {
            return yaml.loadAll(fs.readFileSync(file, "utf8")).filter(Boolean);
        });
        const output = documents.map(document => JSON.stringify(document)).join("\n");
        await fs.promises.writeFile(path.join(PACK_DEST, `${folder}.db`), `${output}\n`);
    }));
}

export const compile = buildPacks;

// Pure, import-safe helpers for talent aptitudes (Dark Heresy 2E). This module
// touches no Foundry globals at module scope, so it is unit-testable under
// node:test and safe to import from the migration runner.
//
// A talent's aptitudes are stored as a structured list of `{key, value}`
// entries mirroring the weapon special-quality shape (see weapon-qualities.js),
// where `key` is a canonical English aptitude tag (matched verbatim against the
// actor's aptitude Item names for XP cost) and `value` is always null (aptitudes
// carry no numeric parameter). The legacy schema stored the same aptitudes as a
// single comma-separated free-text string.

/**
 * Normalize a talent's aptitudes — accepting either the legacy comma-separated
 * string or the structured array (of `{key}` objects or bare strings) — into the
 * canonical `[{key, value: null}]` shape. Blank/whitespace entries are dropped
 * and duplicate keys are collapsed (first occurrence wins). Pure: it reads only
 * its argument and references no Foundry globals.
 * @param {string|Array<{key?: string}|string>|null|undefined} value The stored aptitudes.
 * @returns {{key: string, value: null}[]} The normalized structured aptitudes.
 */
export function parseTalentAptitudes(value) {
    const names = Array.isArray(value)
        ? value.map(entry => (typeof entry === "string" ? entry : entry?.key))
        : typeof value === "string"
            ? value.split(",")
            : [];
    const seen = new Set();
    const result = [];
    for (const raw of names) {
        const key = typeof raw === "string" ? raw.trim() : "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({ key, value: null });
    }
    return result;
}

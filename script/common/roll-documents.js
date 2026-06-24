/**
 * Resolve the actor that originated stored roll data. UUIDs preserve synthetic
 * token identity; the remaining branches support older chat cards.
 * @param {object} rollData
 * @returns {Actor|null}
 */
export function resolveRollActor(rollData) {
    if (!rollData) return null;
    if (rollData.actorUuid) {
        const actor = fromUuidSync(rollData.actorUuid);
        if (actor) return actor;
    }
    if (rollData.tokenId) {
        const actor = game.actors.tokens[rollData.tokenId];
        if (actor) return actor;
    }
    return game.actors.get(rollData.ownerId) ?? null;
}

/**
 * Resolve the owned item that originated stored roll data.
 * @param {object} rollData
 * @returns {Item|null}
 */
export function resolveRollItem(rollData) {
    if (!rollData) return null;
    if (rollData.itemUuid) {
        const item = fromUuidSync(rollData.itemUuid);
        if (item) return item;
    }
    return resolveRollActor(rollData)?.items?.get(rollData.itemId) ?? null;
}

/**
 * Link one owned ammunition item to one owned weapon, adding it to the weapon's
 * loaded-ammo list (a weapon may carry several types) and keeping the reverse
 * link consistent. An ammunition belongs to at most one weapon, so it is
 * detached from any previous weapon it was linked to.
 * @param {Item} weapon The actor-owned weapon.
 * @param {Item} ammunition The actor-owned ammunition.
 * @returns {Promise<Item[]>} Updated embedded items.
 */
export async function linkAmmunition(weapon, ammunition) {
    const actor = weapon?.actor;
    if (!actor || ammunition?.actor !== actor || weapon.type !== "weapon" || ammunition.type !== "ammunition") {
        return [];
    }

    const updates = new Map();
    const addUpdate = (item, change) => {
        if (!item) return;
        updates.set(item.id, { ...(updates.get(item.id) ?? { _id: item.id }), ...change });
    };

    // Detach this ammunition from any OTHER weapon that still lists it (an ammo
    // belongs to at most one weapon). We do NOT clear other ammo from THIS weapon —
    // a weapon may carry several loaded ammo types.
    for (const item of actor.items) {
        if (item.type === "weapon"
            && item.id !== weapon.id
            && Array.isArray(item.system.ammo)
            && item.system.ammo.includes(ammunition.id)) {
            addUpdate(item, { "system.ammo": item.system.ammo.filter(id => id !== ammunition.id) });
        }
    }

    addUpdate(weapon, { "system.ammo": [...new Set([...(weapon.system.ammo ?? []), ammunition.id])] });
    addUpdate(ammunition, { "system.weaponId": weapon.id });
    return actor.updateEmbeddedDocuments("Item", Array.from(updates.values()));
}

/**
 * Remove ONE ammunition id from an owned weapon's link list and clear that
 * ammunition's reverse link.
 * @param {Item} weapon The actor-owned weapon.
 * @param {string} ammoId The ammunition id to unlink.
 * @returns {Promise<Item[]>} Updated embedded items.
 */
export async function unlinkWeaponAmmunitionOne(weapon, ammoId) {
    const actor = weapon?.actor;
    if (!actor || weapon.type !== "weapon" || !ammoId) return [];
    const current = Array.isArray(weapon.system.ammo) ? weapon.system.ammo : [];
    if (!current.includes(ammoId)) return [];
    const updates = [{ _id: weapon.id, "system.ammo": current.filter(id => id !== ammoId) }];
    const ammunition = actor.items.get(ammoId);
    if (ammunition?.type === "ammunition" && ammunition.system.weaponId === weapon.id) {
        updates.push({ _id: ammunition.id, "system.weaponId": "" });
    }
    return actor.updateEmbeddedDocuments("Item", updates);
}

/**
 * Remove the weapon link from owned ammunition and its linked weapon.
 * @param {Item} ammunition The actor-owned ammunition.
 * @returns {Promise<Item[]>} Updated embedded items.
 */
export async function unlinkAmmunition(ammunition) {
    const actor = ammunition?.actor;
    if (!actor || ammunition.type !== "ammunition") return [];
    const updates = [{ _id: ammunition.id, "system.weaponId": "" }];
    const weapon = actor.items.get(ammunition.system.weaponId);
    if (weapon?.type === "weapon"
        && Array.isArray(weapon.system.ammo)
        && weapon.system.ammo.includes(ammunition.id)) {
        updates.push({ _id: weapon.id, "system.ammo": weapon.system.ammo.filter(id => id !== ammunition.id) });
    }
    return actor.updateEmbeddedDocuments("Item", updates);
}

/**
 * Link one owned ammunition item to one owned weapon, keeping both stored
 * references consistent and releasing either item's previous partner.
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

    // Clear all conflicting forward and reverse references. This also repairs
    // stale one-sided links when the user makes a new selection.
    for (const item of actor.items) {
        if (item.type === "weapon" && item.id !== weapon.id && item.system.ammo === ammunition.id) {
            addUpdate(item, { "system.ammo": "" });
        }
        if (item.type === "ammunition" && item.id !== ammunition.id && item.system.weaponId === weapon.id) {
            addUpdate(item, { "system.weaponId": "" });
        }
    }

    addUpdate(weapon, { "system.ammo": ammunition.id });
    addUpdate(ammunition, { "system.weaponId": weapon.id });
    return actor.updateEmbeddedDocuments("Item", Array.from(updates.values()));
}

/**
 * Remove the ammunition link from an owned weapon and its linked ammunition.
 * @param {Item} weapon The actor-owned weapon.
 * @returns {Promise<Item[]>} Updated embedded items.
 */
export async function unlinkWeaponAmmunition(weapon) {
    const actor = weapon?.actor;
    if (!actor || weapon.type !== "weapon") return [];
    const updates = [{ _id: weapon.id, "system.ammo": "" }];
    const ammunition = actor.items.get(weapon.system.ammo);
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
    if (weapon?.type === "weapon" && weapon.system.ammo === ammunition.id) {
        updates.push({ _id: weapon.id, "system.ammo": "" });
    }
    return actor.updateEmbeddedDocuments("Item", updates);
}

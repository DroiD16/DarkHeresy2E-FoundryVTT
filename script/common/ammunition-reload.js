/**
 * Refill a weapon and consume one linked ammunition magazine. A depleted linked
 * ammunition item does not block the reload, but invokes the supplied warning.
 * @param {Item} weapon The owned weapon to reload.
 * @param {object} [options] Optional warning side effect.
 * @param {(weapon: Item, ammunition: Item) => Promise<*>} [options.warn]
 * @returns {Promise<void>}
 */
export async function reloadWeapon(weapon, { warn = async () => {} } = {}) {
    if (!weapon) return;
    const ammunition = weapon.system.ammoItem
        ?? weapon.actor?.items.get(weapon.system.ammo);
    const updates = [{ _id: weapon.id, "system.clip.value": weapon.system.clip.max }];
    let depleted = false;

    if (ammunition?.type === "ammunition") {
        const quantity = Math.max(0, Number(ammunition.system.quantity) || 0);
        depleted = quantity === 0;
        updates.push({
            _id: ammunition.id,
            "system.quantity": depleted ? 0 : quantity - 1
        });
    }

    if (weapon.actor) await weapon.actor.updateEmbeddedDocuments("Item", updates);
    else await weapon.update({ "system.clip.value": weapon.system.clip.max });
    if (depleted) await warn(weapon, ammunition);
}

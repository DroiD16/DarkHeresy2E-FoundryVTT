/**
 * Refill a weapon's clip. The ammunition-quantity bookkeeping depends on how many
 * ammunition items are linked:
 *  - 0 linked  -> refill the clip only (free reload; no side effect).
 *  - 1 linked  -> refill the clip and consume one magazine. A depleted linked
 *                 ammunition does not block the reload but invokes `warn`.
 *  - >1 linked -> refill the clip, consume NOTHING, and invoke `remind`: with
 *                 several loaded ammo types the system cannot know which one the
 *                 player loaded, so it asks the player to subtract the rounds.
 * @param {Item} weapon The owned weapon to reload.
 * @param {object} [options] Optional side effects.
 * @param {(weapon: Item, ammunition: Item) => Promise<*>} [options.warn] One-ammo depleted warning.
 * @param {(weapon: Item) => Promise<*>} [options.remind] Multi-ammo manual-subtract reminder.
 * @returns {Promise<void>}
 */
export async function reloadWeapon(weapon, { warn = async () => {}, remind = async () => {} } = {}) {
    if (!weapon) return;
    const ammoItems = weapon.system.ammoItems ?? [];
    const updates = [{ _id: weapon.id, "system.clip.value": weapon.system.clip.max }];
    let depleted = false;
    const single = ammoItems.length === 1 ? ammoItems[0] : null;

    if (single?.type === "ammunition") {
        const quantity = Math.max(0, Number(single.system.quantity) || 0);
        depleted = quantity === 0;
        updates.push({
            _id: single.id,
            "system.quantity": depleted ? 0 : quantity - 1
        });
    }

    if (weapon.actor) await weapon.actor.updateEmbeddedDocuments("Item", updates);
    else await weapon.update({ "system.clip.value": weapon.system.clip.max });

    if (depleted) await warn(weapon, single);
    else if (ammoItems.length > 1) await remind(weapon);
}

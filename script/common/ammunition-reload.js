/**
 * Refill a weapon's clip. The system only auto-tracks ammunition quantity when
 * exactly ONE ammunition item is linked; otherwise it cannot know which rounds
 * the player loaded, so it reminds them to subtract manually:
 *  - exactly 1 linked -> refill the clip and consume one magazine. A depleted
 *                        linked ammunition does not block the reload but invokes
 *                        `warn`.
 *  - 0 or >1 linked   -> refill the clip, consume NOTHING, and invoke `remind`:
 *                        with no tracked ammo (0) or several loaded types (>1)
 *                        the player subtracts the rounds themselves.
 * @param {Item} weapon The owned weapon to reload.
 * @param {object} [options] Optional side effects.
 * @param {(weapon: Item, ammunition: Item) => Promise<*>} [options.warn] One-ammo depleted warning.
 * @param {(weapon: Item) => Promise<*>} [options.remind] Manual-subtract reminder (0 or >1 linked).
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
    else if (ammoItems.length !== 1) await remind(weapon);
}

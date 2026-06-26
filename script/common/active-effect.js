/**
 * System ActiveEffect subclass that gates an item's transferred effects on its
 * install/in-use flag.
 *
 * Items that carry a `system.installed` boolean (cybernetics, weapon
 * modifications, force fields, gear, drugs, tools) suppress their effects on the
 * owning actor while that flag is off, so an effect only applies once the item
 * is actually installed / in use. Items without the flag are unaffected and
 * always apply their effects.
 *
 * No migration accompanies this gate by deliberate decision: on upgrade,
 * existing items read the schema default `installed = false`, so an effect that
 * previously applied unconditionally must be re-enabled by ticking the item's
 * box once. This behaviour change is called out in the release notes.
 * @extends {ActiveEffect}
 */
export class DarkHeresyActiveEffect extends ActiveEffect {

    /** @inheritDoc */
    get isSuppressed() {
        // With CONFIG.ActiveEffect.legacyTransferral = false a transferred
        // effect's `parent` is the owning Item. Suppress only when that item
        // exposes an install/in-use flag that is explicitly off; `=== false`
        // leaves flag-less documents (other item types, and actors) on the
        // core default so their effects keep applying.
        const parent = this.parent;
        if (parent instanceof Item && parent.system?.installed === false) return true;
        return super.isSuppressed;
    }
}

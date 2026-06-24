import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class WeaponData extends EquipmentItemData {

    static defineSchema() {

        const equipmentItemData = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...equipmentItemData,
            class: new fields.StringField({ initial: "" }),
            type: new fields.StringField({ initial: "" }),
            range: new fields.NumberField({ initial: 0 }),
            rateOfFire: new fields.SchemaField({
                single: new fields.NumberField({ initial: 0 }),
                burst: new fields.NumberField({ initial: 0 }),
                full: new fields.NumberField({ initial: 0 })
            }),
            damage: new fields.StringField({ initial: "" }),
            damageType: new fields.StringField({ initial: "impact" }),
            penetration: new fields.StringField({ initial: "0" }),
            clip: new fields.SchemaField({
                max: new fields.NumberField({ initial: 0 }),
                value: new fields.NumberField({ initial: 0 })
            }),
            reload: new fields.StringField({ initial: "Full" }),
            special: new fields.StringField({ initial: "" }),
            specialQualities: new fields.ArrayField(new fields.SchemaField({
                key: new fields.StringField({ required: true, blank: false }),
                value: new fields.NumberField({
                    required: false,
                    nullable: true,
                    initial: null,
                    min: 0,
                    integer: true
                })
            })),
            // Persisted jam/overheat state as a single toggle. Jam and overheat
            // are mutually exclusive per weapon (a weapon with the Overheats
            // quality only ever overheats and never jams, and a weapon without it
            // only ever jams), so one boolean suffices: the attack chat card shows
            // the specific word (jammed vs overheated) at roll time, and the type
            // is otherwise derivable from the weapon's qualities.
            malfunction: new fields.BooleanField({ initial: false }),
            attack: new fields.NumberField({ initial: 0 }),
            ammo: new fields.ArrayField(new fields.StringField({ blank: false }))
        };

    }

    prepareDerivedData() {
        super.prepareDerivedData();

        this.prepareAmmoFetch();

    }

    prepareAmmoFetch() {
        // We only store the ammo ids; here we resolve the whole items and keep them
        // in memory only. Ammo can only be connected to weapons for actor-owned
        // weapons. Stale ids (an ammo deleted while still listed) resolve to
        // undefined and are filtered out so downstream reads never see a hole.
        this.ammoItems = this.parent.actor
            ? this.ammo.map(id => this.parent.actor.items.get(id)).filter(Boolean)
            : [];
    }


    /** @inheritdoc */
    static migrateData(source) {
        super.migrateData(source);

        this.migrateRateOfFire(source);
        this.migrateAmmunitionLink(source);

        return source;
    }

    // The fork's interim schema stored `ammo` as a single string id; the field is
    // now an ArrayField matching the upstream shape. Coerce a legacy string to an
    // array so existing fork worlds and any imported/compendium documents (which
    // the one-time world migration cannot reach) load cleanly: "id" -> ["id"] and
    // "" (the never-linked case) -> [] — without this, ArrayField cleaning would
    // turn "" into a junk [null] element. A value already in the array shape
    // (upstream worlds, freshly-saved fork worlds) is left untouched.
    static migrateAmmunitionLink(source) {
        if (typeof source.ammo === "string") source.ammo = source.ammo ? [source.ammo] : [];
    }

    static migrateRateOfFire(source) {
        if (source.rateOfFire == null) {
            return;
        }

        if (
            !Number.isInteger(source.rateOfFire.single)
            || !Number.isInteger(source.rateOfFire.burst)
            || !Number.isInteger(source.rateOfFire.full)
        ) {
            source.rateOfFire.single = parseInt(source.rateOfFire.single) || 0;
            source.rateOfFire.burst = parseInt(source.rateOfFire.burst) || 0;
            source.rateOfFire.full = parseInt(source.rateOfFire.full) || 0;
        }
    }

}

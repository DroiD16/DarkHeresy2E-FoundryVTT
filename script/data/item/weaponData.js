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
            ammo: new fields.StringField({ initial: "" })
        };

    }

    prepareDerivedData() {
        super.prepareDerivedData();

        this.prepareAmmoFetch();

    }

    prepareAmmoFetch() {
        // We only store a reference to the ammo, here we get the whole item and store it in memory only
        // Ammo can only be connected to weapons for actor owned weapons
        this.ammoItem = this.parent.actor && this.ammo
            ? this.parent.actor.items.get(this.ammo) ?? null
            : null;
    }


    /** @inheritdoc */
    static migrateData(source) {
        super.migrateData(source);

        this.migrateRateOfFire(source);
        this.migrateAmmunitionLink(source);

        return source;
    }

    // The released upstream (4.4.0.0) weapon schema stored `ammo` as an array of
    // linked ammunition ids; the active-ammunition model is singular. Preserve
    // the first stored id when an old array is encountered and normalize an empty
    // array to the schema's empty-string sentinel. Kept as a read-time safety net
    // for imported/compendium documents the one-time world migration cannot reach.
    static migrateAmmunitionLink(source) {
        if (Array.isArray(source.ammo)) source.ammo = source.ammo.find(id => typeof id === "string" && id) ?? "";
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

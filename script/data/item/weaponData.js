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
        this.migrateMalfunction(source);
        this.migrateSpecialQualities(source);
        this.migrateAmmunitionLink(source);

        return source;
    }

    // Migrate the legacy string `malfunction` ("" | "jammed" | "overheated") to
    // the boolean field. V13's BooleanField casts a string to true only when it
    // is exactly "true", so "jammed"/"overheated" would otherwise silently become
    // false and a malfunctioning weapon would appear cleared on load. Convert any
    // non-empty legacy string to true; "" -> false. Idempotent (a boolean source
    // is left untouched).
    static migrateMalfunction(source) {
        if (typeof source.malfunction === "string") {
            source.malfunction = source.malfunction !== "";
        }
    }

    static migrateSpecialQualities(source) {
        if (!Array.isArray(source.specialQualities)) return;
        for (const quality of source.specialQualities) {
            if (quality?.value === null || typeof quality?.value === "undefined") continue;
            const value = Number(quality.value);
            quality.value = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
        }
    }

    // The upstream implementation briefly allowed multiple linked ammunition
    // items. The active-ammunition model is singular again; preserve the first
    // stored ID when an old array is encountered and normalize an empty array to
    // the schema's empty-string sentinel.
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

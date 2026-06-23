import EquipmentItemData from "./equipmentItemData.js";

const fields = foundry.data.fields;

export default class AmmunitionData extends EquipmentItemData {

    static defineSchema() {

        const equipmentItemData = super.defineSchema();
        return {
            // Using destructuring to effectively append our additional data here
            ...equipmentItemData,
            quantity: new fields.NumberField({ initial: 0 }),
            effect: new fields.SchemaField({
                damage: new fields.SchemaField({
                    modifier: new fields.StringField({ initial: "0" }),
                    type: new fields.StringField({ initial: "impact" })
                }),
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
                penetration: new fields.StringField({ initial: "0" }),
                attack: new fields.SchemaField({
                    modifier: new fields.NumberField({ initial: 0 })
                })
            }),
            weapon: new fields.StringField({ initial: "" }),
            weaponId: new fields.StringField({ initial: "" })
        };

    }

    prepareDerivedData() {
        super.prepareDerivedData();

        this.prepareWeaponFetch();

    }

    prepareWeaponFetch() {
        // We only store a reference to the weapon, here we get the whole item and store it in memory only
        // Weapons can only be connected to ammo for actor owned ammo
        if (this.parent.actor && this.weaponId && this.weaponId !== "") {
            this.weaponItem = this.parent.actor.items.get(this.weaponId);
            this.weapon = this.weaponItem?.name ?? "";
        }

        if (this.parent.actor && this.weaponId === "") {
            this.weaponItem = null;
            this.weapon = "";
        }
    }

    /** @inheritdoc */
    static migrateData(source) {
        super.migrateData(source);

        this.migrateDamageModifier(source);
        this.migrateSpecialQualities(source);

        return source;
    }

    static migrateDamageModifier(source) {
        if (source.effect?.damage) {
            source.effect.damage.modifier = parseInt(source.effect.damage?.modifier) || 0;
        }
    }

    // Numeric normalizer for the structured qualities, nested under `effect`.
    // NORMALIZE ONLY: it never parses the free-text `effect.special` field into
    // structured qualities (that migration is out of scope; the regex parser in
    // util.js is retained for it). Mirrors WeaponData.migrateSpecialQualities,
    // with the array read from `source.effect.specialQualities`.
    static migrateSpecialQualities(source) {
        if (!source.effect || !Array.isArray(source.effect.specialQualities)) return;
        for (const quality of source.effect.specialQualities) {
            if (quality?.value === null || typeof quality?.value === "undefined") continue;
            const value = Number(quality.value);
            quality.value = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
        }
    }
}

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

        return source;
    }

    // The released upstream (4.4.0.0) ammunition schema stored
    // `effect.damage.modifier` as a string; the field is now numeric. Coerce any
    // legacy string to an integer. Kept as a read-time safety net for
    // imported/compendium documents the one-time world migration cannot reach.
    static migrateDamageModifier(source) {
        if (source.effect?.damage) {
            source.effect.damage.modifier = parseInt(source.effect.damage?.modifier) || 0;
        }
    }
}

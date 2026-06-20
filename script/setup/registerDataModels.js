import AmmunitionData from "../data/item/ammunitionData.js";
import WeaponData from "../data/item/weaponData.js";
import ItemDescriptionData from "../data/item/itemDescriptionData.js";
import TraitData from "../data/item/traitData.js";
import SpecialAbilityData from "../data/item/specialAbilityData.js";
import CriticalInjuryData from "../data/item/criticalInjuryData.js";
import ArmourData from "../data/item/armourData.js";
import CyberneticData from "../data/item/cyberneticData.js";
import DrugData from "../data/item/drugData.js";
import ForceFieldData from "../data/item/forceFieldData.js";
import GearData from "../data/item/gearData.js";
import ToolData from "../data/item/toolData.js";
import WeaponModificationData from "../data/item/weaponModificationData.js";

export const registerDataModels = () => {
    foundry.utils.mergeObject(CONFIG.Actor.dataModels, {
        // Stub for when Actors are moved to data models
    });

    foundry.utils.mergeObject(CONFIG.Item.dataModels, {
        // The keys are the types defined in our template.json
        weapon: WeaponData,
        ammunition: AmmunitionData,
        // The following description-based types need no migrateData: every field
        // is an unchanged string with the same default as the prior template, so
        // existing items and compendium entries validate as-is.
        aptitude: ItemDescriptionData,
        malignancy: ItemDescriptionData,
        mentalDisorder: ItemDescriptionData,
        mutation: ItemDescriptionData,
        trait: TraitData,
        specialAbility: SpecialAbilityData,
        criticalInjury: CriticalInjuryData,
        // The following equipment-based types extend EquipmentItemData and need no
        // migrateData: every field keeps the exact template type and default, and
        // NumberField gracefully cleans any legacy string numbers, so existing
        // items and compendium entries validate as-is.
        armour: ArmourData,
        cybernetic: CyberneticData,
        drug: DrugData,
        forceField: ForceFieldData,
        gear: GearData,
        tool: ToolData,
        weaponModification: WeaponModificationData
    });
};

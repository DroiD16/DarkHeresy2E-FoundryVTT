import AmmunitionData from "../data/item/ammunitionData.js";
import WeaponData from "../data/item/weaponData.js";
import ItemDescriptionData from "../data/item/itemDescriptionData.js";
import TraitData from "../data/item/traitData.js";
import SpecialAbilityData from "../data/item/specialAbilityData.js";
import CriticalInjuryData from "../data/item/criticalInjuryData.js";

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
        criticalInjury: CriticalInjuryData
    });
};

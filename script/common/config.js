import { WEAPON_QUALITIES } from "./weapon-qualities.js";

let Dh = {};

Dh.attackType = {};

// Single source of truth for weapon special qualities (see weapon-qualities.js).
// Exposed on the config object as game.darkHeresy.config.weaponQualities for the
// display helper and the Chunk B chip-list editor, mirroring Dh.aptitudes.
Dh.weaponQualities = WEAPON_QUALITIES;

Dh.attackTypeRanged = {
    none: "ATTACK_TYPE.NONE",
    standard: "ATTACK_TYPE.STANDARD",
    semi_auto: "ATTACK_TYPE.SEMI_AUTO",
    full_auto: "ATTACK_TYPE.FULL_AUTO",
    called_shot: "ATTACK_TYPE.CALLED_SHOT"
};

Dh.attackTypeMelee = {
    none: "ATTACK_TYPE.NONE",
    standard: "ATTACK_TYPE.STANDARD",
    charge: "ATTACK_TYPE.CHARGE",
    swift: "ATTACK_TYPE.SWIFT",
    lightning: "ATTACK_TYPE.LIGHTNING",
    allOut: "ATTACK_TYPE.ALLOUT",
    called_shot: "ATTACK_TYPE.CALLED_SHOT"
};

Dh.attackTypePsy = {
    none: "ATTACK_TYPE.NONE",
    bolt: "PSYCHIC_POWER.BOLT",
    barrage: "PSYCHIC_POWER.BARRAGE",
    storm: "PSYCHIC_POWER.STORM",
    blast: "PSYCHIC_POWER.BLAST"
};

Dh.ranges = {
    pointBlank: "RANGE.POINT_BLANK",
    short: "RANGE.SHORT",
    normal: "RANGE.NONE",
    long: "RANGE.LONG",
    extreme: "RANGE.EXTREME"
};

Dh.damageTypes = {
    energy: "DAMAGE_TYPE.ENERGY",
    impact: "DAMAGE_TYPE.IMPACT",
    rending: "DAMAGE_TYPE.RENDING",
    explosive: "DAMAGE_TYPE.EXPLOSIVE"
};

Dh.aimModes = {
    0: "AIMING.NONE",
    10: "AIMING.HALF",
    20: "AIMING.FULL"
};

Dh.evasions = {
    dodge: "SKILL.DODGE",
    parry: "SKILL.PARRY",
    deny: "DIALOG.DENY_THE_WITCH"
};

Dh.craftmanship = {
    poor: "CRAFTSMANSHIP.POOR",
    common: "CRAFTSMANSHIP.COMMON",
    good: "CRAFTSMANSHIP.GOOD",
    best: "CRAFTSMANSHIP.BEST"
};

Dh.availability = {
    ubiquitous: "AVAILABILITY.UBIQUITOUS",
    abundant: "AVAILABILITY.ABUNDANT",
    plentiful: "AVAILABILITY.PLENTIFUL",
    common: "AVAILABILITY.COMMON",
    average: "AVAILABILITY.AVERAGE",
    scarce: "AVAILABILITY.SCARCE",
    rare: "AVAILABILITY.RARE",
    "very-rare": "AVAILABILITY.VERY_RARE",
    "extremely-rare": "AVAILABILITY.EXTREMELY_RARE",
    "near-unique": "AVAILABILITY.NEAR_UNIQUE",
    unique: "AVAILABILITY.UNIQUE"
};


Dh.armourTypes = {
    basic: "ARMOUR_TYPE.BASIC",
    flak: "ARMOUR_TYPE.FLAK",
    mesh: "ARMOUR_TYPE.MESH",
    carapace: "ARMOUR_TYPE.CARAPACE",
    power: "ARMOUR_TYPE.POWER"
};

Dh.weaponType = {
    las: "WEAPON.LAS",
    solidprojectile: "WEAPON.SOLIDPROJECTILE",
    bolt: "WEAPON.BOLT",
    melta: "WEAPON.MELTA",
    plasma: "WEAPON.PLASMA",
    flame: "WEAPON.FLAME",
    lowtech: "WEAPON.LOWTECH",
    launcher: "WEAPON.LAUNCHER",
    explosive: "WEAPON.EXPLOSIVE",
    exotic: "WEAPON.EXOTIC",
    chain: "WEAPON.CHAIN",
    power: "WEAPON.POWER",
    shock: "WEAPON.SHOCK",
    force: "WEAPON.FORCE"
};

Dh.weaponClass = {
    melee: "WEAPON.MELEE",
    thrown: "WEAPON.THROWN",
    pistol: "WEAPON.PISTOL",
    basic: "WEAPON.BASIC",
    heavy: "WEAPON.HEAVY",
    launched: "WEAPON.LAUNCHED",
    placed: "WEAPON.PLACED",
    vehicle: "WEAPON.VEHICLE"
};

Dh.psykerClass = {
    bound: "PSYCHIC_POWER.BOUND",
    unbound: "PSYCHIC_POWER.UNBOUND",
    daemonic: "PSYCHIC_POWER.DAEMONIC"
};

Dh.advanceStagesCharacteristics = {
    0: "ADVANCE.NONE",
    5: "ADVANCE.SIMPLE",
    10: "ADVANCE.INTERMEDIATE",
    15: "ADVANCE.TRAINED",
    20: "ADVANCE.PROFICIENT",
    25: "ADVANCE.EXPERT"
};

Dh.advanceStagesSkills = {
    "-20": "ADVANCE.UNTRAINED",
    0: "ADVANCE.KNOWN",
    10: "ADVANCE.TRAINED",
    20: "ADVANCE.EXPERIENCED",
    30: "ADVANCE.VETERAN"
};

Dh.characteristicCosts = [
    [0, 0, 0],
    [100, 250, 500],
    [250, 500, 750],
    [500, 750, 1000],
    [750, 1000, 1500],
    [1250, 1500, 2500]];

Dh.talentCosts = [[200, 300, 600], [300, 450, 900], [400, 600, 1200]];

// Single source of truth for aptitude tags: canonical English tag -> i18n key.
// The XP cost calc (script/common/actor.js) matches the canonical English tag
// stored in the aptitude Item's `name`; this map is RENDER-ONLY (datalist,
// display helper, reverse normalizer) and is never written back into `name`.
// The 9 characteristic-named tags reuse CHARACTERISTIC.* keys (localized in
// fr/pl/es today); the 10 APTITUDE.* tags fall back to en in non-en locales
// until translated. XP correctness is unaffected either way.
Dh.aptitudes = {
    "Weapon Skill": "CHARACTERISTIC.WEAPON_SKILL",
    "Ballistic Skill": "CHARACTERISTIC.BALLISTIC_SKILL",
    Strength: "CHARACTERISTIC.STRENGTH",
    Toughness: "CHARACTERISTIC.TOUGHNESS",
    Agility: "CHARACTERISTIC.AGILITY",
    Intelligence: "CHARACTERISTIC.INTELLIGENCE",
    Perception: "CHARACTERISTIC.PERCEPTION",
    Willpower: "CHARACTERISTIC.WILLPOWER",
    Fellowship: "CHARACTERISTIC.FELLOWSHIP",
    Offence: "APTITUDE.OFFENCE",
    Finesse: "APTITUDE.FINESSE",
    Defence: "APTITUDE.DEFENCE",
    Knowledge: "APTITUDE.KNOWLEDGE",
    Fieldcraft: "APTITUDE.FIELDCRAFT",
    Psyker: "APTITUDE.PSYKER",
    Social: "APTITUDE.SOCIAL",
    Leadership: "APTITUDE.LEADERSHIP",
    Tech: "APTITUDE.TECH",
    General: "APTITUDE.GENERAL"
};

// Single source of truth for the psychic-power Focus Power test field: the
// canonical char/skill KEY (the actor schema property, e.g. "weaponSkill",
// "commonLore") -> its i18n label key. Mirrors the aptitude map's role:
// powers store the canonical KEY (locale-independent, so it resolves the same
// on every client), while this map drives the styled dropdown, the display
// helper, and the reverse normalizer. Keys + label keys are transcribed from
// script/data/actor/actorBaseData.js (all 10 characteristics + all 28 skills),
// so a static map works on an UNOWNED item sheet too (no actor required).
// getFocusPowerTarget (util.js) resolves the stored KEY against the actor's
// characteristics/skills; this map is RENDER-ONLY and never written into data.
Dh.focusPowerTests = {
    weaponSkill: "CHARACTERISTIC.WEAPON_SKILL",
    ballisticSkill: "CHARACTERISTIC.BALLISTIC_SKILL",
    strength: "CHARACTERISTIC.STRENGTH",
    toughness: "CHARACTERISTIC.TOUGHNESS",
    agility: "CHARACTERISTIC.AGILITY",
    intelligence: "CHARACTERISTIC.INTELLIGENCE",
    perception: "CHARACTERISTIC.PERCEPTION",
    willpower: "CHARACTERISTIC.WILLPOWER",
    fellowship: "CHARACTERISTIC.FELLOWSHIP",
    influence: "CHARACTERISTIC.INFLUENCE",
    acrobatics: "SKILL.ACROBATICS",
    athletics: "SKILL.ATHLETICS",
    awareness: "SKILL.AWARENESS",
    charm: "SKILL.CHARM",
    command: "SKILL.COMMAND",
    commerce: "SKILL.COMMERCE",
    commonLore: "SKILL.COMMON_LORE",
    deceive: "SKILL.DECEIVE",
    dodge: "SKILL.DODGE",
    forbiddenLore: "SKILL.FORBIDDEN_LORE",
    inquiry: "SKILL.INQUIRY",
    interrogation: "SKILL.INTERROGATION",
    intimidate: "SKILL.INTIMIDATE",
    linguistics: "SKILL.LINGUISTICS",
    logic: "SKILL.LOGIC",
    medicae: "SKILL.MEDICAE",
    navigate: "SKILL.NAVIGATE",
    operate: "SKILL.OPERATE",
    parry: "SKILL.PARRY",
    psyniscience: "SKILL.PSYNISCIENCE",
    scholasticLore: "SKILL.SCHOLASTIC_LORE",
    scrutiny: "SKILL.SCRUTINY",
    security: "SKILL.SECURITY",
    sleightOfHand: "SKILL.SLEIGHT_OF_HAND",
    stealth: "SKILL.STEALTH",
    survival: "SKILL.SURVIVAL",
    techUse: "SKILL.TECH_USE",
    trade: "SKILL.TRADE"
};

// Curated subset SUGGESTED in the Focus Power test dropdown (keys, in display
// order). The dropdown only SUGGESTS these; getFocusPowerTarget still resolves
// ANY characteristic/skill a stored value matches and falls back to willpower
// only when nothing resolves. focusPowerTests above stays the full map (used for
// display localisation and the submit reverse-map of any value).
Dh.focusPowerSuggestions = ["willpower", "psyniscience", "perception", "awareness"];

Dh.hitLocations = {
    head: "ARMOUR.HEAD",
    leftArm: "ARMOUR.LEFT_ARM",
    rightArm: "ARMOUR.RIGHT_ARM",
    body: "ARMOUR.BODY",
    leftLeg: "ARMOUR.LEFT_LEG",
    rightLeg: "ARMOUR.RIGHT_LEG"
};

CONFIG.statusEffects = [
    {
        id: "bleeding",
        statuses: ["bleeding"],
        name: "CONDITION.BLEEDING",
        img: "systems/dark-heresy/asset/icons/bleeding.png"
    },
    {
        id: "blinded",
        statuses: ["blinded"],
        name: "CONDITION.BLINDED",
        img: "systems/dark-heresy/asset/icons/blinded.png"
    },
    {
        id: "deafened",
        statuses: ["deafened"],
        name: "CONDITION.DEAFEND",
        img: "systems/dark-heresy/asset/icons/deafened.png"
    },
    {
        id: "fear",
        statuses: ["fear"],
        name: "CONDITION.FEAR",
        img: "systems/dark-heresy/asset/icons/fear.png"
    },
    {
        id: "fire",
        statuses: ["fire"],
        name: "CONDITION.FIRE",
        img: "systems/dark-heresy/asset/icons/flame.png"
    },
    {
        id: "grappled",
        statuses: ["grappled"],
        name: "CONDITION.GRAPPLED",
        img: "systems/dark-heresy/asset/icons/grappled.png"
    },
    {
        id: "hidden",
        statuses: ["hidden"],
        name: "CONDITION.HIDDEN",
        img: "systems/dark-heresy/asset/icons/hidden.png"
    },
    {
        id: "pinned",
        statuses: ["pinned"],
        name: "CONDITION.PINNED",
        img: "systems/dark-heresy/asset/icons/pinning.png"
    },
    {
        id: "poisond",
        statuses: ["poisond"],
        name: "CONDITION.POISONED",
        img: "systems/dark-heresy/asset/icons/poisoned.png"
    },
    {
        id: "prone",
        statuses: ["prone"],
        name: "CONDITION.PRONE",
        img: "systems/dark-heresy/asset/icons/prone.png"
    },
    {
        id: "stunned",
        statuses: ["stunned"],
        name: "CONDITION.STUNNED",
        img: "systems/dark-heresy/asset/icons/stunned.png"
    },
    {
        id: "unconscious",
        statuses: ["unconscious"],
        name: "CONDITION.UNCONSCIOUS",
        img: "systems/dark-heresy/asset/icons/unconscious.png"
    },
    {
        id: "dead",
        statuses: ["dead"],
        name: "EFFECT.StatusDead", // Foundry Default Text Key
        img: "systems/dark-heresy/asset/icons/dead.png"
    }
];

export default Dh;

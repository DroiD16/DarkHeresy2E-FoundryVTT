const fields = foundry.data.fields;

/**
 * Build a SchemaField for a single characteristic, transcribed from
 * template.json Actor.templates.characteristics.
 * @param {string} label          Localisation key for the characteristic name.
 * @param {string} short          Short abbreviation (e.g. "WS").
 * @param {string[]} aptitudes    Default aptitude tags for the characteristic.
 * @returns {object}              A stubbed/real SchemaField for the characteristic.
 */
function characteristic(label, short, aptitudes) {
    return new fields.SchemaField({
        label: new fields.StringField({ initial: label }),
        short: new fields.StringField({ initial: short }),
        base: new fields.NumberField({ initial: 0 }),
        advance: new fields.NumberField({ initial: 0 }),
        unnatural: new fields.NumberField({ initial: 0 }),
        aptitudes: new fields.ArrayField(new fields.StringField(), { initial: aptitudes }),
        cost: new fields.NumberField({ initial: 0 }),
        damage: new fields.NumberField({ initial: 0 })
    });
}

/**
 * Expand a { key: label } map into the populated specialities object used as the
 * ObjectField initial. Each speciality matches the template exactly:
 * { label, advance: -20, virtualAdvance: -20, starter: false, cost: 0 }.
 * @param {{[key: string]: string}} labelMap   Map of speciality key to display label.
 * @returns {object}                          Populated specialities object.
 */
function specialities(labelMap) {
    const out = {};
    for (const [key, label] of Object.entries(labelMap)) {
        out[key] = { label, base: 0, advance: -20, virtualAdvance: -20, starter: false, cost: 0 };
    }
    return out;
}

/**
 * Build a SchemaField for a single skill, transcribed from
 * template.json Actor.templates.skills. `specMap` is {} for non-specialist
 * skills or a { key: label } map for specialist skills.
 * @param {string} label                       Localisation key for the skill name.
 * @param {string[]} characteristics           Characteristic abbreviations the skill may use.
 * @param {boolean} isSpecialist               Whether the skill is a specialist skill.
 * @param {string[]} aptitudes                 Default aptitude tags for the skill.
 * @param {{[key: string]: string}} [specMap]   Speciality key to label map (specialist skills only).
 * @returns {object}                           A stubbed/real SchemaField for the skill.
 */
function skill(label, characteristics, isSpecialist, aptitudes, specMap = {}) {
    // Transcribed from template.json: specialist skills omit the top-level
    // `starter`/`cost` keys (those live per-speciality), while non-specialist
    // skills carry them. Match the authoritative template exactly.
    const def = {
        label: new fields.StringField({ initial: label }),
        characteristics: new fields.ArrayField(new fields.StringField(), { initial: characteristics }),
        base: new fields.NumberField({ initial: 0 }),
        advance: new fields.NumberField({ initial: -20 }),
        virtualAdvance: new fields.NumberField({ initial: -20 }),
        isSpecialist: new fields.BooleanField({ initial: isSpecialist }),
        specialities: new fields.ObjectField({ initial: specialities(specMap) }),
        aptitudes: new fields.ArrayField(new fields.StringField(), { initial: aptitudes })
    };
    if (!isSpecialist) {
        def.starter = new fields.BooleanField({ initial: false });
        def.cost = new fields.NumberField({ initial: 0 });
    }
    return new fields.SchemaField(def);
}

const commonLoreSpecialities = {
    adeptaSororitas: "Adepta Sororitas",
    adeptusArbites: "Adeptus Arbites",
    adeptusAstartes: "Adeptus Astartes",
    adeptusAstraTelepathica: "Adeptus Astra Telepathica",
    adeptusMechanicus: "Adeptus Mechanicus",
    administratum: "Administratum",
    askellonSector: "Askellon Sector",
    chartistCaptains: "Chartist Captains",
    collegiaTitanicu: "Collegia Titanicu",
    ecclesiarchy: "Ecclesiarchy",
    imperialCreed: "Imperial Creed",
    imperialGuard: "Imperial Guard",
    imperialNavy: "Imperial Navy",
    imperium: "Imperium",
    navigators: "Navigators",
    planetaryDefenceForces: "Planetary Defence Forces",
    rogueTraders: "Rogue Traders",
    scholaProgenium: "Schola Progenium",
    tech: "Tech",
    underworld: "Underworld",
    war: "War"
};

const forbiddenLoreSpecialities = {
    archaeotech: "Archaeotech",
    chaosSpaceMarines: "Chaos Space Marines",
    criminalCartelsAndSmugglers: "Criminal Cartels and Smugglers",
    daemonology: "Daemonology",
    heresy: "Heresy",
    theHorusHeresyAndTheLongWar: "The Horus Heresy and the Long War",
    inquisition: "Inquisition",
    mutants: "Mutants",
    officioAssassinorum: "Officio Assassinorum",
    pirates: "Pirates",
    psykers: "Psykers",
    theWarp: "The Warp",
    xenos: "Xenos"
};

const linguisticsSpecialities = {
    chapterRunes: "Chapter Runes",
    chaosMarks: "Chaos Marks",
    eldar: "Eldar",
    highGothic: "High Gothic",
    imperialCodes: "Imperial Codes",
    lowGothic: "Low Gothic",
    mercenary: "Mercenary",
    necrontyr: "Necrontyr",
    ork: "Ork",
    technaLingua: "Techna-Lingua",
    tau: "Tau",
    underworld: "Underworld",
    xenosMarkings: "Xenos Markings"
};

const navigateSpecialities = {
    surface: "Surface",
    stellar: "Stellar",
    warp: "Warp"
};

const operateSpecialities = {
    surface: "Surface",
    aeronautica: "Aeronautica",
    voidship: "Voidship"
};

const scholasticLoreSpecialities = {
    astromancy: "Astromancy",
    beasts: "Beasts",
    bureaucracy: "Bureaucracy",
    chymistry: "Chymistry",
    cryptology: "Cryptology",
    heraldry: "Heraldry",
    imperialWarrants: "Imperial Warrants",
    judgement: "Judgement",
    legend: "Legend",
    numerology: "Numerology",
    occult: "Occult",
    philosophy: "Philosophy",
    tacticaImperialis: "Tactica Imperialis"
};

const tradeSpecialities = {
    agri: "Agri",
    archaeologist: "Archaeologist",
    armourer: "Armourer",
    astrographer: "Astrographer",
    chymist: "Chymist",
    cryptographer: "Cryptographer",
    cook: "Cook",
    explorator: "Explorator",
    linguist: "Linguist",
    loremancer: "Loremancer",
    morticator: "Morticator",
    performancer: "Performancer",
    prospector: "Prospector",
    scrimshawer: "Scrimshawer",
    sculptor: "Sculptor",
    shipwright: "Shipwright",
    soothsayer: "Soothsayer",
    technomat: "Technomat",
    voidfarer: "Voidfarer"
};

/**
 * Shared base data model for both acolyte and npc actors. Transcribes the seven
 * shared templates from template.json (characteristics, skills, initiative,
 * wounds, fatigue, fate, psy) as SchemaFields. Derived values (totals, bonuses,
 * spent experience, etc.) are computed at runtime by DarkHeresyActor and are NOT
 * part of this schema.
 */
export default class DarkHeresyActorData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            characteristics: new fields.SchemaField({
                weaponSkill: characteristic("CHARACTERISTIC.WEAPON_SKILL", "WS", ["Weapon Skill", "Offence"]),
                ballisticSkill: characteristic("CHARACTERISTIC.BALLISTIC_SKILL", "BS", ["Ballistic Skill", "Finesse"]),
                strength: characteristic("CHARACTERISTIC.STRENGTH", "S", ["Strength", "Offence"]),
                toughness: characteristic("CHARACTERISTIC.TOUGHNESS", "T", ["Toughness", "Defence"]),
                agility: characteristic("CHARACTERISTIC.AGILITY", "Ag", ["Agility", "Finesse"]),
                intelligence: characteristic("CHARACTERISTIC.INTELLIGENCE", "Int", ["Intelligence", "Knowledge"]),
                perception: characteristic("CHARACTERISTIC.PERCEPTION", "Per", ["Perception", "Fieldcraft"]),
                willpower: characteristic("CHARACTERISTIC.WILLPOWER", "WP", ["Willpower", "Psyker"]),
                fellowship: characteristic("CHARACTERISTIC.FELLOWSHIP", "Fel", ["Fellowship", "Social"]),
                influence: characteristic("CHARACTERISTIC.INFLUENCE", "Inf", [])
            }),
            skills: new fields.SchemaField({
                acrobatics: skill("SKILL.ACROBATICS", ["Ag", "S"], false, ["Agility", "General"]),
                athletics: skill("SKILL.ATHLETICS", ["S", "T"], false, ["Strength", "General"]),
                awareness: skill("SKILL.AWARENESS", ["Per", "Fel", "Int"], false, ["Perception", "Fieldcraft"]),
                charm: skill("SKILL.CHARM", ["Fel", "Inf"], false, ["Fellowship", "Social"]),
                command: skill("SKILL.COMMAND", ["Fel", "Int", "S", "WP"], false, ["Fellowship", "Leadership"]),
                commerce: skill("SKILL.COMMERCE", ["Int", "Fel"], false, ["Intelligence", "Knowledge"]),
                commonLore: skill("SKILL.COMMON_LORE", ["Int", "Fel"], true, ["Intelligence", "Knowledge"], commonLoreSpecialities),
                deceive: skill("SKILL.DECEIVE", ["Fel", "Int"], false, ["Fellowship", "Social"]),
                dodge: skill("SKILL.DODGE", ["Ag"], false, ["Agility", "Defence"]),
                forbiddenLore: skill("SKILL.FORBIDDEN_LORE", ["Int", "Fel"], true, ["Intelligence", "Knowledge"], forbiddenLoreSpecialities),
                inquiry: skill("SKILL.INQUIRY", ["Fel", "Int", "Per"], false, ["Fellowship", "Social"]),
                interrogation: skill("SKILL.INTERROGATION", ["WP", "Fel"], false, ["Willpower", "Social"]),
                intimidate: skill("SKILL.INTIMIDATE", ["S", "WP"], false, ["Strength", "Social"]),
                linguistics: skill("SKILL.LINGUISTICS", ["Int", "Fel"], true, ["Intelligence", "General"], linguisticsSpecialities),
                logic: skill("SKILL.LOGIC", ["Int", "Ag"], false, ["Intelligence", "Knowledge"]),
                medicae: skill("SKILL.MEDICAE", ["Int", "Ag", "Per"], false, ["Intelligence", "Fieldcraft"]),
                navigate: skill("SKILL.NAVIGATE", ["Int", "Per"], true, ["Intelligence", "Fieldcraft"], navigateSpecialities),
                operate: skill("SKILL.OPERATE", ["Ag", "Int"], true, ["Agility", "Fieldcraft"], operateSpecialities),
                parry: skill("SKILL.PARRY", ["WS"], false, ["Weapon Skill", "Defence"]),
                psyniscience: skill("SKILL.PSYNISCIENCE", ["Per", "WP"], false, ["Perception", "Psyker"]),
                scholasticLore: skill("SKILL.SCHOLASTIC_LORE", ["Int", "Fel"], true, ["Intelligence", "Knowledge"], scholasticLoreSpecialities),
                scrutiny: skill("SKILL.SCRUTINY", ["Per", "Fel"], false, ["Perception", "General"]),
                security: skill("SKILL.SECURITY", ["Int", "Ag"], false, ["Intelligence", "Tech"]),
                sleightOfHand: skill("SKILL.SLEIGHT_OF_HAND", ["Ag", "Int"], false, ["Agility", "Knowledge"]),
                stealth: skill("SKILL.STEALTH", ["Ag", "Per"], false, ["Agility", "Fieldcraft"]),
                survival: skill("SKILL.SURVIVAL", ["Per", "Ag", "Int"], false, ["Perception", "Fieldcraft"]),
                techUse: skill("SKILL.TECH_USE", ["Int", "Ag"], false, ["Intelligence", "Tech"]),
                trade: skill("SKILL.TRADE", ["Int", "Ag", "Fel"], true, ["Intelligence", "General"], tradeSpecialities)
            }),
            initiative: new fields.SchemaField({
                characteristic: new fields.StringField({ initial: "agility" }),
                base: new fields.StringField({ initial: "1d10" })
            }),
            wounds: new fields.SchemaField({
                max: new fields.NumberField({ initial: 0 }),
                value: new fields.NumberField({ initial: 0 }),
                critical: new fields.NumberField({ initial: 0 })
            }),
            fatigue: new fields.SchemaField({
                base: new fields.NumberField({ initial: 0 }),
                max: new fields.NumberField({ initial: 0 }),
                value: new fields.NumberField({ initial: 0 })
            }),
            fate: new fields.SchemaField({
                max: new fields.NumberField({ initial: 0 }),
                value: new fields.NumberField({ initial: 0 })
            }),
            psy: new fields.SchemaField({
                rating: new fields.NumberField({ initial: 0 }),
                sustained: new fields.NumberField({ initial: 0 }),
                class: new fields.StringField({ initial: "bound" }),
                cost: new fields.NumberField({ initial: 0 })
            }),
            armour: new fields.SchemaField({
                head: armourLocation(),
                leftArm: armourLocation(),
                rightArm: armourLocation(),
                body: armourLocation(),
                leftLeg: armourLocation(),
                rightLeg: armourLocation()
            }),
            movement: new fields.SchemaField({
                half: movementRate(),
                full: movementRate(),
                charge: movementRate(),
                run: movementRate()
            }),
            modifiers: new fields.SchemaField({
                attack: new fields.SchemaField({
                    melee: modifier(),
                    ranged: modifier()
                }),
                focusPower: modifier()
            })
        };
    }
}

/**
 * Build the stored base field for one body location's derived armour data.
 * @returns {object} A SchemaField with the AE-targetable base value.
 */
function armourLocation() {
    return new fields.SchemaField({
        base: new fields.NumberField({ initial: 0 })
    });
}

/**
 * Build the stored base field for one movement rate's derived total.
 * @returns {object} A SchemaField with the AE-targetable base value.
 */
function movementRate() {
    return new fields.SchemaField({
        base: new fields.NumberField({ initial: 0 })
    });
}

/**
 * Build a generic stored actor modifier group.
 * @returns {object} A SchemaField with the AE-targetable base value.
 */
function modifier() {
    return new fields.SchemaField({
        base: new fields.NumberField({ initial: 0 })
    });
}

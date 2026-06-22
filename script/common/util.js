import { buildTraitsFromQualities } from "./weapon-qualities.js";

export default class DarkHeresyUtil {

    // Single source of truth for the name an item gets at creation time. Both
    // the actor sheet's create handler and any "is this still the default name?"
    // detection call this so the two can never drift apart.
    static defaultItemName(type) {
        return `New ${game.i18n.localize(`TYPES.Item.${type.toLowerCase()}`)}`;
    }

    static createCommonAttackRollData(actor, item) {
        return {
            name: item.name,
            itemName: item.name, // Seperately here because evasion may override it
            ownerId: actor.id,
            itemId: item.id,
            target: {
                base: 0,
                modifier: 0
            },
            weapon: {
                damageBonus: 0,
                damageType: item.damageType
            },
            psy: {
                value: actor.psy.rating,
                display: false
            },
            attackType: {
                name: "standard",
                text: ""
            },
            flags: {
                isAttack: true
            }
        };
    }

    static createCommonNormalRollData(actor, value) {
        return {
            target: {
                base: value.total,
                modifier: 0
            },
            flags: {
                isAttack: false
            },
            ownerId: actor.id
        };
    }

    static createWeaponRollData(actor, weaponItem) {
        let characteristic = this.getWeaponCharacteristic(actor, weaponItem);
        let rateOfFire;
        if (weaponItem.class === "melee") {
            rateOfFire = { burst: characteristic.bonus, full: characteristic.bonus };
        } else {
            rateOfFire = { burst: weaponItem.rateOfFire.burst, full: weaponItem.rateOfFire.full };
        }
        let weaponTraits = buildTraitsFromQualities(weaponItem.system.specialQualities);
        let isMelee = weaponItem.class === "melee";
        let attributeMod = (isMelee && !weaponItem.damage.match(/SB/gi) ? "+SB" : "");

        let rollData = this.createCommonAttackRollData(actor, weaponItem);

        rollData.target.base = characteristic.total + weaponItem.attack;
        rollData.rangeMod = !isMelee ? 10 : 0;

        rollData.weapon = foundry.utils.mergeObject(rollData.weapon, {
            isMelee: isMelee,
            isRange: !isMelee,
            clip: weaponItem.clip,
            rateOfFire: rateOfFire,
            range: !isMelee ? weaponItem.range : 0,
            damageFormula: weaponItem.damage + attributeMod + (weaponTraits.force ? "+PR" : ""),
            penetrationFormula: weaponItem.penetration + (weaponTraits.force ? "+PR" : ""),
            ammos: weaponItem.system.ammoItems,
            traits: weaponTraits,
            special: weaponItem.special
        });

        return rollData;
    }

    static createPsychicRollData(actor, power) {
        let focusPowerTarget = this.getFocusPowerTarget(actor, power);

        let rollData = this.createCommonAttackRollData(actor, power);
        rollData.target.base = focusPowerTarget.total;
        rollData.target.modifier = power.focusPower.difficulty;
        rollData.weapon = foundry.utils.mergeObject(rollData.weapon, {
            damageFormula: power.damage.formula,
            penetrationFormula: power.damage.penetration,
            traits: this.extractWeaponTraits(power.damage.special),
            special: power.damage.special
        });
        rollData.attackType.name = power.damage.zone;
        // Sustaining lowers the effective Psy Rating by the number of sustained
        // powers (actor.psy.currentRating = rating - sustained, derived in
        // _computeCharacteristics). The focus roll uses this EFFECTIVE rating as
        // its base/fetter-push reference, floored at 1 so a fully-sustained
        // psyker can still cast (just at the minimum). The class bonus (max push
        // headroom: bound +2 / unbound +4 / daemonic +3) is measured from the
        // full rating, so it stays the same number of points and is re-anchored
        // onto the effective base.
        const effectiveBase = Math.max(1, actor.psy.currentRating);
        const classBonus = this.getMaxPsyRating(actor) - actor.psy.rating;
        rollData.psy = {
            value: effectiveBase,
            rating: effectiveBase,
            class: actor.psy.class,
            sustained: actor.psy.sustained,
            max: effectiveBase + classBonus,
            warpConduit: false,
            display: true
        };
        return rollData;
    }

    static createSkillRollData(actor, skillName) {
        const skill = actor.skills[skillName];
        const defaultChar = skill.defaultCharacteristic || skill.characteristics[0];

        let characteristics = this.getCharacteristicOptions(actor, defaultChar);
        characteristics = characteristics.map(char => {
            char.target += skill.advance;
            return char;
        });

        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, skill), {
            name: skill.label,
            characteristics: characteristics
        });
    }

    static createSpecialtyRollData(actor, skillName, specialityName) {
        const skill = actor.skills[skillName];
        const speciality = skill.specialities[specialityName];
        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, speciality), {
            name: speciality.label
        });
    }

    static createCharacteristicRollData(actor, characteristicName) {
        const characteristic = actor.characteristics[characteristicName];
        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, characteristic), {
            name: characteristic.label
        });
    }

    static createFearTestRolldata(actor) {
        const characteristic = actor.characteristics.willpower;
        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, characteristic), {
            name: "FEAR.HEADER"
        });
    }

    static createMalignancyTestRolldata(actor) {
        const characteristic = actor.characteristics.willpower;
        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, characteristic), {
            name: "CORRUPTION.MALIGNANCY",
            target: {
                modifier: this.getMalignancyModifier(actor.corruption)
            }
        });
    }

    static createTraumaTestRolldata(actor) {
        const characteristic = actor.characteristics.willpower;
        return foundry.utils.mergeObject(this.createCommonNormalRollData(actor, characteristic), {
            name: "TRAUMA.HEADER",
            target: {
                modifier: this.getTraumaModifier(actor.insanity)
            }
        });
    }


    static extractWeaponTraits(traits) {
        // These weapon traits never go above 9 or below 2
        return {
            accurate: this.hasNamedTrait(/(?<!in)Accurate/gi, traits),
            rfFace: this.extractNumberedTrait(/Vengeful.*\(\d\)/gi, traits), // The alternativ die face Righteous Fury is triggered on
            proven: this.extractNumberedTrait(/Proven.*\(\d\)/gi, traits),
            primitive: this.extractNumberedTrait(/Primitive.*\(\d\)/gi, traits),
            razorSharp: this.hasNamedTrait(/Razor.?-? *Sharp/gi, traits),
            spray: this.hasNamedTrait(/Spray/gi, traits),
            skipAttackRoll: this.hasNamedTrait(/Spray/gi, traits), // Currently, spray will always be the same as skipAttackRoll. However, in the future, there may be other skipAttackRoll weapons that are not Spray.
            tearing: this.hasNamedTrait(/Tearing/gi, traits),
            storm: this.hasNamedTrait(/Storm/gi, traits),
            twinLinked: this.hasNamedTrait(/Twin.?-? *Linked/gi, traits),
            force: this.hasNamedTrait(/Force/gi, traits),
            inaccurate: this.hasNamedTrait(/Inaccurate/gi, traits)
        };
    }

    static getMaxPsyRating(actor) {
        let base = actor.psy.rating;
        switch (actor.psy.class) {
            case "bound":
                return base + 2;
            case "unbound":
                return base + 4;
            case "daemonic":
                return base + 3;
        }
    }

    static extractNumberedTrait(regex, traits) {
        let rfMatch = traits.match(regex);
        if (rfMatch) {
            regex = /\d+/gi;
            return parseInt(rfMatch[0].match(regex)[0]);
        }
        return undefined;
    }

    static hasNamedTrait(regex, traits) {
        let rfMatch = traits.match(regex);
        if (rfMatch) {
            return true;
        } else {
            return false;
        }
    }

    static getWeaponCharacteristic(actor, weapon) {
        if (weapon.class === "melee") {
            return actor.characteristics.weaponSkill;
        } else {
            return actor.characteristics.ballisticSkill;
        }
    }

    static getFocusPowerTarget(actor, psychicPower) {
        // The stored value is the canonical char/skill KEY (Dh.focusPowerTests),
        // saved locale-independently by the sheet so it resolves the same on
        // every client. Resolution order:
        //   (a) EXACT key match — actor.characteristics[test] then .skills[test].
        //       Uses Object.hasOwn (no lowercasing) so camelCase keys like
        //       "weaponSkill"/"commonLore" match correctly (the old
        //       toLowerCase() turned them into "weaponskill" and silently fell
        //       through to willpower).
        //   (b) NORMALIZED fallback for LEGACY free-text values typed before
        //       this feature ('WP', 'Willpower', 'Common Lore', ''...): build a
        //       lowercased lookup from each characteristic/skill's canonical
        //       key, localized label, and (characteristics only) short
        //       abbreviation, then resolve the trimmed/lowercased value.
        //   (c) DEFAULT willpower for empty/unknown — so existing worlds never
        //       break and no migration is needed.
        const test = psychicPower.focusPower.test ?? "";

        // (a) Exact canonical-key match.
        if (Object.hasOwn(actor.characteristics, test)) return actor.characteristics[test];
        if (Object.hasOwn(actor.skills, test)) return actor.skills[test];

        // (b) Normalized legacy lookup. Characteristics first so a label/short
        // collision (defensive) resolves to the characteristic.
        const normalized = test.trim().toLowerCase();
        if (normalized) {
            const lookup = {};
            const register = (stat, key) => {
                const add = token => {
                    if (token) lookup[String(token).trim().toLowerCase()] ??= stat;
                };
                add(key);
                add(stat.label && game.i18n.localize(stat.label));
                add(stat.short);
            };
            for (const [key, stat] of Object.entries(actor.characteristics)) register(stat, key);
            for (const [key, stat] of Object.entries(actor.skills)) register(stat, key);
            if (lookup[normalized]) return lookup[normalized];
        }

        // (c) Default.
        return actor.characteristics.willpower;
    }

    static getCharacteristicOptions(actor, selected) {
        const characteristics = [];
        for (let char of Object.values(actor.characteristics)) {
            characteristics.push({
                label: char.label,
                target: char.total,
                selected: char.short === selected
            });
        }
        return characteristics;
    }

    static getMalignancyModifier(corruption) {
        if (corruption <= 30) {
            return 0;
        } else if (corruption <= 60) {
            return -10;
        } else if (corruption <= 90) {
            return -20;
        } else {
            return -30;
        }
    }

    static getTraumaModifier(insanity) {
        if (insanity < 10) {
            return 0;
        } else if (insanity < 40) {
            return 10;
        } else if (insanity < 60) {
            return 0;
        } else if (insanity < 80) {
            return -10;
        } else {
            return -20;
        }
    }

    static categorizeEffects(effects) {
        const categories = {
            temporary: {
                type: "temporary",
                label: game.i18n.localize("DH.Effect.Temporary"),
                effects: []
            },
            passive: {
                type: "passive",
                label: game.i18n.localize("DH.Effect.Passive"),
                effects: []
            },
            inactive: {
                type: "inactive",
                label: game.i18n.localize("DH.Effect.Inactive"),
                effects: []
            }
        };

        for (const e of effects) {
            if (e.disabled) categories.inactive.effects.push(e);
            else if (e.isTemporary) categories.temporary.effects.push(e);
            else categories.passive.effects.push(e);
        }
        return categories;
    }
}

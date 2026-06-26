import { ammunitionMultiplier, buildTraitsFromQualities } from "./weapon-qualities.js";

/**
 * Map a weapon's resolved ammunition items to the lean descriptors the combat
 * dialog needs. Kept as a pure module function (NOT full Documents — rollData is
 * serialized into the chat message for the reroll path) so the 0/1/>1 boundary
 * that decides the dialog control (>1 -> native selector; exactly 1 -> name span;
 * 0 -> nothing) is unit-testable in isolation.
 * @param {Array<{id: string, name: string}>} ammoItems The derived ammoItems array.
 * @returns {{ammos: Array<{id,name}>, hasMultipleAmmo: boolean, singleAmmo: ({id,name}|null)}}
 */
export function ammoDialogData(ammoItems) {
    const ammos = (ammoItems ?? []).map(a => ({ id: a.id, name: a.name }));
    return {
        ammos,
        hasMultipleAmmo: ammos.length > 1,
        singleAmmo: ammos.length === 1 ? ammos[0] : null
    };
}

export default class DarkHeresyUtil {

    // Single source of truth for the name an item gets at creation time. Both
    // the actor sheet's create handler and any "is this still the default name?"
    // detection call this so the two can never drift apart.
    static defaultItemName(type) {
        const localizedType = game.i18n.localize(`TYPES.Item.${type.toLowerCase()}`);
        return game.i18n.format("ITEM.NEW", { type: localizedType });
    }

    static createCommonAttackRollData(actor, item) {
        return {
            name: item.name,
            itemName: item.name, // Seperately here because evasion may override it
            ownerId: actor.id,
            actorUuid: actor.uuid,
            tokenId: actor.token?.id,
            itemId: item.id,
            itemUuid: item.uuid,
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
        rollData.target.automationModifier = 0;
        rollData.target.actorModifier = isMelee
            ? actor.modifiers.attack.melee.base
            : actor.modifiers.attack.ranged.base;
        rollData.target.totalModifier = 0;
        rollData.rangeBand = !isMelee ? "short" : undefined;
        rollData.rangeMod = !isMelee ? 10 : 0;

        rollData.weapon = foundry.utils.mergeObject(rollData.weapon, {
            isMelee: isMelee,
            isRange: !isMelee,
            isPistol: weaponItem.class === "pistol",
            showRangeBand: !isMelee && (!weaponTraits.skipAttackRoll
                || weaponTraits.melta || weaponTraits.scatter),
            clip: weaponItem.clip,
            rateOfFire: rateOfFire,
            range: !isMelee ? weaponItem.range : 0,
            damageFormula: weaponItem.damage + attributeMod + (weaponTraits.force ? "+PR" : ""),
            penetrationFormula: weaponItem.penetration + (weaponTraits.force ? "+PR" : ""),
            // The weapon's intrinsic (pre-bonus) penetration, used by the Lance
            // quality which scales only the base value per degree of success.
            basePenetration: weaponItem.penetration,
            // Lean {id,name} list + the dialog discriminators (>1 -> selector;
            // exactly 1 -> name span). See ammoDialogData below — extracted so the
            // 0/1/>1 boundary is unit-testable without the full rollData surface.
            ...ammoDialogData(weaponItem.system.ammoItems),
            traits: weaponTraits,
            // The weapon's raw structured qualities, stashed so the combat
            // dialog can union them with the loaded ammunition's qualities at
            // fire time (mergeSpecialQualities -> buildTraitsFromQualities).
            specialQualities: weaponItem.system.specialQualities,
            special: weaponItem.special,
            malfunction: weaponItem.system.malfunction,
            maximalAvailable: weaponItem.clip.max <= 0
                || weaponItem.clip.value >= ammunitionMultiplier(weaponTraits, true),
            // Craftsmanship shifts ranged reliability (jam/overheat) and the
            // Spray jam-on-9 check (see computeMalfunction/computeSprayMalfunction).
            craftsmanship: weaponItem.system.craftsmanship
        });
        rollData.flags.showAutomationModifier = true;

        return rollData;
    }

    static createPsychicRollData(actor, power) {
        let focusPowerTarget = this.getFocusPowerTarget(actor, power);

        let rollData = this.createCommonAttackRollData(actor, power);
        rollData.target.base = focusPowerTarget.total;
        rollData.target.modifier = power.focusPower.difficulty;
        rollData.target.actorModifier = actor.modifiers.focusPower.base;
        rollData.target.automationModifier = rollData.target.actorModifier;
        rollData.weapon = foundry.utils.mergeObject(rollData.weapon, {
            damageFormula: power.damage.formula,
            penetrationFormula: power.damage.penetration,
            traits: buildTraitsFromQualities(power.damage.specialQualities),
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
            useModifier: true,
            display: true
        };
        return rollData;
    }

    static createSkillRollData(actor, skillName) {
        const skill = actor.skills[skillName];
        const defaultChar = skill.defaultCharacteristic || skill.characteristics[0];

        let characteristics = this.getCharacteristicOptions(actor, defaultChar);
        characteristics = characteristics.map(char => {
            char.target += (Number(skill.base) || 0) + skill.advance;
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

    /**
     * Capture the scroll offsets of every scrollable container within an element.
     * Pair with {@link DarkHeresyUtil.restoreScrollPositions} to preserve scroll
     * across an ApplicationV2 part re-render (e.g. each `submitOnChange` edit).
     *
     * Why this exists, and why restore is deferred to `_onRender`: the framework's
     * built-in `part.scrollable` option restores scroll inside `_syncPartState`,
     * which runs while the freshly rendered tab still lacks its `active` class and
     * is therefore `display:none` — a `scrollTop` written to a hidden element is
     * silently dropped. The active tab only gains `active` later, in the sheet's
     * `_onRender` → `_activateTabs()`. So we read offsets here from the still-visible
     * prior DOM and re-apply them after the tab is shown.
     *
     * Each selector is captured into its own bucket (rather than one merged
     * document-order list) so that a container which appears/disappears between
     * renders — e.g. the edit-conditional `.quality-chips` editor on item sheets —
     * can only shift indices within its own bucket, never another selector's.
     *
     * @param {HTMLElement} element   The element to read from (the pre-render part,
     *                                whose active tab is still on screen).
     * @param {string[]} selectors    CSS selectors matching the scroll containers.
     * @returns {Array<Array<[number, number]>>} Per selector, `[scrollTop, scrollLeft]`
     *                                           for each match in document order.
     */
    static captureScrollPositions(element, selectors) {
        return selectors.map(selector =>
            Array.from(element.querySelectorAll(selector), el => [el.scrollTop, el.scrollLeft])
        );
    }

    /**
     * Re-apply scroll offsets captured by {@link DarkHeresyUtil.captureScrollPositions},
     * matching each selector's current containers to its captured bucket by
     * document-order index. Per-selector container counts are fixed by the template
     * (only the rows inside them vary), so the mapping is stable; a count mismatch —
     * e.g. a conditional editor toggling within its bucket — is bounded by `Math.min`.
     *
     * Must be called after the active tab is re-activated (so its containers are
     * laid out), otherwise the writes land on hidden elements and are dropped.
     *
     * @param {HTMLElement} element                        The current part element (active tab visible).
     * @param {string[]} selectors                         CSS selectors matching the scroll containers.
     * @param {Array<Array<[number, number]>>} captured    Offsets from a prior capture.
     */
    static restoreScrollPositions(element, selectors, captured) {
        if (!captured?.length) return;
        selectors.forEach((selector, bucket) => {
            const positions = captured[bucket];
            if (!positions?.length) return;
            const containers = element.querySelectorAll(selector);
            const count = Math.min(containers.length, positions.length);
            for (let i = 0; i < count; i++) {
                const [top, left] = positions[i];
                if (top || left) Object.assign(containers[i], { scrollTop: top, scrollLeft: left });
            }
        });
    }
}

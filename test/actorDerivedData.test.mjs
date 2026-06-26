import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.Actor = class {
    prepareBaseData() {}
    prepareDerivedData() {}
};

globalThis.foundry = {
    utils: {
        mergeObject: (original, other) => ({ ...original, ...other })
    }
};

globalThis.game = {
    darkHeresy: {
        config: {
            hitLocations: {
                head: "ARMOUR.HEAD",
                leftArm: "ARMOUR.LEFT_ARM",
                rightArm: "ARMOUR.RIGHT_ARM",
                body: "ARMOUR.BODY",
                leftLeg: "ARMOUR.LEFT_LEG",
                rightLeg: "ARMOUR.RIGHT_LEG"
            },
            advanceStagesCharacteristics: { 0: "ADVANCE.NONE" },
            advanceStagesSkills: { "-20": "ADVANCE.UNTRAINED", 0: "ADVANCE.KNOWN" },
            characteristicCosts: [[0, 0, 0]]
        }
    },
    settings: {
        get: () => true
    },
    i18n: {
        localize: key => key,
        has: () => false
    }
};

const { DarkHeresyActor } = await import("../script/common/actor.js");
const { default: DarkHeresyUtil } = await import("../script/common/util.js");

function actor(system, items = []) {
    const instance = Object.create(DarkHeresyActor.prototype);
    instance.system = system;
    instance.items = items;
    return instance;
}

test("skill totals include skill base and speciality base", () => {
    const dh = actor({
        characteristics: {
            intelligence: { short: "Int", total: 40 }
        },
        skills: {
            logic: {
                characteristics: ["Int"],
                base: 5,
                advance: 10,
                isSpecialist: false
            },
            trade: {
                characteristics: ["Int"],
                base: 3,
                advance: -20,
                isSpecialist: true,
                specialities: {
                    armourer: { base: 7, advance: 10 }
                }
            }
        }
    });

    dh._computeSkills();

    assert.equal(dh.system.skills.logic.total, 55);
    assert.equal(dh.system.skills.trade.specialities.armourer.total, 60);
});

test("skill totals use virtual advance only when it is higher than advance", () => {
    const dh = actor({
        characteristics: {
            intelligence: { short: "Int", total: 40 }
        },
        skills: {
            logic: {
                characteristics: ["Int"],
                base: 5,
                advance: 0,
                virtualAdvance: 20,
                isSpecialist: false
            },
            medicae: {
                characteristics: ["Int"],
                base: 5,
                advance: 10,
                virtualAdvance: 0,
                isSpecialist: false
            }
        }
    });

    dh._computeSkills();

    assert.equal(dh.system.skills.logic.total, 65);
    assert.equal(dh.system.skills.medicae.total, 55);
});

test("speciality totals use virtual advance without changing known state", () => {
    const dh = actor({
        characteristics: {
            intelligence: { short: "Int", total: 40 }
        },
        skills: {
            trade: {
                characteristics: ["Int"],
                base: 3,
                advance: -20,
                isSpecialist: true,
                specialities: {
                    armourer: { base: 7, advance: -20, virtualAdvance: 10 }
                }
            }
        }
    });

    dh._computeSkills();

    assert.equal(dh.system.skills.trade.specialities.armourer.total, 60);
    assert.equal(dh.system.skills.trade.specialities.armourer.isKnown, false);
});

test("auto experience uses advance instead of virtual advance", () => {
    const dh = actor({
        characteristics: {},
        skills: {
            logic: {
                characteristics: ["Int"],
                aptitudes: ["Intelligence", "Knowledge"],
                advance: 10,
                virtualAdvance: 30,
                starter: false,
                isSpecialist: false
            }
        },
        experience: { spentOther: 0, value: 1000 },
        psy: { rating: 0, cost: 0 }
    }, [
        { isAptitude: true, name: "Intelligence" },
        { isAptitude: true, name: "Knowledge" }
    ]);

    dh._computeExperience_auto();

    assert.equal(dh.system.skills.logic.cost, 300);
    assert.equal(dh.system.experience.spentSkills, 300);
});

test("skill roll data uses virtual advance for characteristic targets", () => {
    const rollData = DarkHeresyUtil.createSkillRollData({
        id: "actor-id",
        characteristics: {
            intelligence: { label: "Intelligence", short: "Int", total: 40 },
            fellowship: { label: "Fellowship", short: "Fel", total: 30 }
        },
        skills: {
            logic: {
                label: "Logic",
                characteristics: ["Int", "Fel"],
                base: 5,
                advance: 0,
                virtualAdvance: 20,
                total: 65
            }
        }
    }, "logic");

    assert.deepEqual(rollData.characteristics.map(c => c.target), [65, 55]);
    assert.equal(rollData.target.base, 65);
});

test("specialist skill roll data uses parent skill without a speciality", () => {
    const rollData = DarkHeresyUtil.createSkillRollData({
        id: "actor-id",
        characteristics: {
            intelligence: { label: "Intelligence", short: "Int", total: 40 },
            fellowship: { label: "Fellowship", short: "Fel", total: 30 }
        },
        skills: {
            commonLore: {
                label: "Common Lore",
                characteristics: ["Int", "Fel"],
                base: 5,
                advance: -20,
                virtualAdvance: -20,
                total: 25,
                isSpecialist: true,
                specialities: {}
            }
        }
    }, "commonLore");

    assert.deepEqual(rollData.characteristics.map(c => c.target), [25, 15]);
    assert.equal(rollData.target.base, 25);
    assert.equal(rollData.name, "Common Lore");
});

test("fatigue max includes fatigue base", () => {
    const characteristics = {
        toughness: { short: "T", base: 30, advance: 5, unnatural: 0, total: 0, bonus: 0 },
        willpower: { short: "WP", base: 40, advance: 0, unnatural: 0, total: 0, bonus: 0 }
    };
    const dh = actor({
        characteristics,
        fatigue: { base: 2, value: 0, max: 0 },
        insanity: 0,
        corruption: 0,
        psy: { rating: 0, sustained: 0 },
        initiative: { characteristic: "toughness" }
    });

    dh._computeCharacteristics();

    assert.equal(dh.system.fatigue.max, 9);
});

test("armour total is AP only and damageReduction adds toughness bonus", () => {
    const dh = actor({
        characteristics: {
            toughness: { bonus: 3 }
        },
        armour: {
            head: { base: 2 },
            leftArm: { base: 0 },
            rightArm: { base: 0 },
            body: { base: 1 },
            leftLeg: { base: 0 },
            rightLeg: { base: 0 }
        }
    }, [
        { isArmour: true, isAdditive: false, part: { head: 4, body: 5 } },
        { isArmour: true, isAdditive: true, part: { head: 1, body: 1 } }
    ]);

    dh._computeArmour();

    assert.equal(dh.system.armour.head.total, 7);
    assert.equal(dh.system.armour.head.toughnessBonus, 3);
    assert.equal(dh.system.armour.head.damageReduction, 10);
    assert.equal(dh._getArmour("ARMOUR.HEAD"), 7);
    assert.equal(dh.system.armour.body.total, 7);
});

test("movement totals include per-rate base modifiers", () => {
    const dh = actor({
        characteristics: {
            agility: { bonus: 4 }
        },
        size: 4,
        movement: {
            half: { base: 1 },
            full: { base: 2 },
            charge: { base: -1 },
            run: { base: 3 }
        }
    });

    dh._computeMovement();

    assert.deepEqual(dh.system.movement, {
        half: { base: 1, total: 5 },
        full: { base: 2, total: 10 },
        charge: { base: -1, total: 11 },
        run: { base: 3, total: 27 }
    });
});

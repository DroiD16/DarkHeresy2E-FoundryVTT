import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.Actor = class {
    prepareBaseData() {}
    prepareDerivedData() {}
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
            advanceStagesSkills: { "-20": "ADVANCE.UNTRAINED", 0: "ADVANCE.KNOWN" }
        }
    },
    i18n: {
        localize: key => key,
        has: () => false
    }
};

const { DarkHeresyActor } = await import("../script/common/actor.js");

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

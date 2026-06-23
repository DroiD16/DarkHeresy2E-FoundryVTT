import { test } from "node:test";
import assert from "node:assert/strict";

const documents = new Map();
globalThis.fromUuidSync = uuid => documents.get(uuid) ?? null;
globalThis.game = {
    actors: {
        tokens: {},
        get: () => null
    }
};

const { resolveRollActor, resolveRollItem } =
    await import("../script/common/roll-documents.js");

test("roll document resolution preserves a synthetic token item by UUID", () => {
    const actor = { id: "base", items: new Map() };
    const item = { id: "weapon", actor };
    documents.set("Scene.scene.Token.token.Actor.base", actor);
    documents.set("Scene.scene.Token.token.Actor.base.Item.weapon", item);

    const rollData = {
        actorUuid: "Scene.scene.Token.token.Actor.base",
        itemUuid: "Scene.scene.Token.token.Actor.base.Item.weapon",
        ownerId: "base",
        itemId: "weapon"
    };
    assert.equal(resolveRollActor(rollData), actor);
    assert.equal(resolveRollItem(rollData), item);
});

test("roll document resolution supports token and world-actor legacy data", () => {
    const tokenItem = { id: "token-weapon" };
    const tokenActor = { items: new Map([["weapon", tokenItem]]) };
    game.actors.tokens.token = tokenActor;
    assert.equal(resolveRollItem({ tokenId: "token", itemId: "weapon" }), tokenItem);

    const worldItem = { id: "world-weapon" };
    const worldActor = { items: new Map([["weapon", worldItem]]) };
    game.actors.get = id => id === "actor" ? worldActor : null;
    assert.equal(resolveRollItem({ ownerId: "actor", itemId: "weapon" }), worldItem);
});

import assert from "node:assert/strict";
import test from "node:test";

class MeasuredTemplateStub {
    constructor(document = {}) {
        this.document = document;
        this.layer = null;
        this.refreshCount = 0;
        this.snappedPositions = [];
    }

    getSnappedPosition(position) {
        this.snappedPositions.push(position);
        return {x: position.x + 1, y: position.y + 2};
    }

    refresh() {
        this.refreshCount += 1;
    }
}

globalThis.foundry = {
    canvas: {
        placeables: {
            MeasuredTemplate: MeasuredTemplateStub
        }
    }
};

const { PlaceableTemplate } = await import("../script/common/placeable-template.js");

function makeTemplate({generation = 13} = {}) {
    const updates = [];
    const document = {
        x: 10,
        y: 20,
        updateSource(update) {
            updates.push(update);
            Object.assign(this, update);
        },
        toObject() {
            return {x: this.x, y: this.y};
        }
    };
    const template = new PlaceableTemplate(document);
    const stage = {
        handlers: new Map(),
        offCalls: [],
        on(eventName, handler) {
            this.handlers.set(eventName, handler);
        },
        off(eventName, handler) {
            this.offCalls.push([eventName, handler]);
            this.handlers.delete(eventName);
        }
    };
    const layer = {
        dragCancelCount: 0,
        clearPreviewCount: 0,
        activateCount: 0,
        _onDragLeftCancel() {
            this.dragCancelCount += 1;
        },
        clearPreviewContainer() {
            this.clearPreviewCount += 1;
        },
        activate() {
            this.activateCount += 1;
        }
    };
    const created = [];
    globalThis.game = {release: {generation}};
    globalThis.canvas = {
        app: {view: {}},
        scene: {
            createEmbeddedDocuments(type, documents) {
                created.push({type, documents});
                return documents;
            }
        },
        stage,
        templates: {
            getSnappedPoint(point) {
                return {x: point.x + 10, y: point.y + 20};
            }
        }
    };
    template.layer = layer;
    return {created, document, layer, stage, template, updates};
}

function activate(template, initialLayer) {
    return template.activatePreviewListeners(initialLayer);
}

test("template preview movement uses placeable snapping", () => {
    const {document, layer, template, updates} = makeTemplate();
    activate(template, layer);

    template._onMovePlacement({
        stopPropagation() {},
        data: {
            getLocalPosition(targetLayer) {
                assert.equal(targetLayer, layer);
                return {x: 3, y: 4};
            }
        }
    });

    assert.deepEqual(template.snappedPositions, [{x: 3, y: 4}]);
    assert.deepEqual(updates, [{x: 4, y: 6}]);
    assert.equal(document.x, 4);
    assert.equal(document.y, 6);
    assert.equal(template.refreshCount, 1);
});

test("template confirmation snaps with the template layer and creates a measured template", async () => {
    const {created, document, layer, template, updates} = makeTemplate();
    const placement = activate(template, layer);

    await template._onConfirmPlacement({});
    const result = await placement;

    assert.equal(layer.dragCancelCount, 1);
    assert.equal(layer.clearPreviewCount, 0);
    assert.deepEqual(updates, [{x: 20, y: 40}]);
    assert.deepEqual(created, [{
        type: "MeasuredTemplate",
        documents: [{x: 20, y: 40}]
    }]);
    assert.deepEqual(result, [{x: 20, y: 40}]);
    assert.equal(document.x, 20);
    assert.equal(document.y, 40);
});

test("template placement cleanup uses V14 preview container clearing", async () => {
    const {layer, template} = makeTemplate({generation: 14});
    activate(template, layer);

    await template._finishPlacement({});

    assert.equal(layer.dragCancelCount, 0);
    assert.equal(layer.clearPreviewCount, 1);
    assert.equal(layer.activateCount, 1);
});

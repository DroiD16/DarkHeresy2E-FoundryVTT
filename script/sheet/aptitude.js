import { DarkHeresyItemSheet } from "./item.js";
import DarkHeresyUtil from "../common/util.js";

export class AptitudeSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "aptitude"]
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/aptitude.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Localized labels for the custom name dropdown. Each label populates a
        // <li class="aptitude-suggestion"> item (its data-value and visible text)
        // shown in the styled suggestions list, so a picked suggestion appears
        // correctly localized; _processFormData reverse-maps a chosen/typed
        // localized label back to the canonical English tag on submit.
        context.aptitudeSuggestions = Object.values(game.darkHeresy.config.aptitudes)
            .map(key => game.i18n.localize(key));
        // A freshly created aptitude still carries the auto-generated default
        // name ("New Aptitude"), which matches no suggestion. When it
        // does, the template renders an empty value + placeholder so the custom
        // dropdown shows the full list and typing filters it. Compared via the
        // shared helper so this can never drift from the create handler.
        // (Edge: an aptitude a user deliberately names exactly "New Aptitude"
        // will also render empty+placeholder on reopen; the stored value is
        // unaffected.)
        context.aptitudeNameIsDefault = this.item.name === DarkHeresyUtil.defaultItemName("aptitude");
        return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // Delegated listeners on the persistent window frame (the same precedent
        // the actor sheet uses): this.element survives part re-renders, so these
        // bind ONCE and keep working after every submitOnChange re-render. Each
        // listener resolves the wrapper via closest(".aptitude-autocomplete") and
        // bails if the event is outside it, so the rest of the sheet is ignored.
        const element = this.element;

        // Open on pointerdown (NOT focusin): the programmatic focus-restoration
        // after a pick's re-render must not re-open the dropdown. Guard to the
        // input itself so a pointerdown on a <li> (also inside the wrapper) does
        // not pre-empt that li's mousedown -> commit. Do not preventDefault, so
        // focus proceeds normally.
        element.addEventListener("pointerdown", event => {
            const root = event.target.closest(".aptitude-autocomplete");
            if (!root) return;
            // The caret toggles the dropdown. preventDefault keeps focus from
            // being stolen (no blur churn), then focus the input and flip the
            // list's visibility: open when hidden, close when shown.
            if (event.target.closest(".aptitude-caret")) {
                event.preventDefault();
                this.#acInput(root).focus();
                if (this.#acList(root)?.hidden) this.#acOpen(root);
                else this.#acClose(root);
                return;
            }
            if (event.target !== this.#acInput(root)) return;
            this.#acOpen(root);
        });

        // Typing filters; it never commits/submits (that would re-render mid-type).
        element.addEventListener("input", event => {
            const root = event.target.closest(".aptitude-autocomplete");
            if (!root || event.target !== this.#acInput(root)) return;
            const list = this.#acList(root);
            if (list?.hidden) this.#acOpen(root);
            else this.#acFilter(root);
        });

        element.addEventListener("keydown", event => {
            const root = event.target.closest(".aptitude-autocomplete");
            if (!root || event.target !== this.#acInput(root)) return;
            const list = this.#acList(root);
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    if (list?.hidden) this.#acOpen(root);
                    else this.#acMove(root, 1);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    if (list?.hidden) this.#acOpen(root);
                    else this.#acMove(root, -1);
                    break;
                case "Enter": {
                    // Always handle Enter ourselves: deterministic commit through
                    // the single synthetic-change path, never native form submit.
                    event.preventDefault();
                    const active = list?.querySelector(".aptitude-suggestion.active:not(.hidden)");
                    this.#acCommit(root, active ? active.dataset.value : this.#acInput(root).value);
                    break;
                }
                case "Escape":
                    // Hide the UI; leave the typed text uncommitted.
                    event.preventDefault();
                    this.#acClose(root);
                    break;
            }
        });

        // Pointer-pick: preventDefault FIRST so the input keeps focus (no blur
        // before the click lands), then commit the picked label.
        element.addEventListener("mousedown", event => {
            // The caret is a non-focusable <i>; its default mousedown would blur
            // the input, and that blur -> focusout -> #acClose would immediately
            // re-hide a list the pointerdown toggle just opened. preventDefault
            // here keeps focus on the input so the open toggle actually sticks
            // (mirrors the suggestion-pick focus-keeping below). The pointerdown
            // handler already performed the open/close; nothing else to do here.
            if (event.target.closest(".aptitude-caret")) {
                event.preventDefault();
                return;
            }
            const li = event.target.closest(".aptitude-suggestion");
            if (!li) return;
            const root = li.closest(".aptitude-autocomplete");
            if (!root) return;
            event.preventDefault();
            this.#acCommit(root, li.dataset.value);
        });

        // Leaving the wrapper hides the dropdown UI only. The native blur/change
        // is NOT blocked, so a free-text edit committed by clicking away still
        // fires its own change -> _processFormData -> save.
        element.addEventListener("focusout", event => {
            const root = event.target.closest(".aptitude-autocomplete");
            if (!root) return;
            this.#acClose(root);
        });
    }

    /**
     * The name input inside an autocomplete wrapper.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     * @returns {HTMLInputElement} The name input.
     */
    #acInput(root) {
        return root.querySelector("input[name=name]");
    }

    /**
     * The suggestion list inside an autocomplete wrapper.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     * @returns {HTMLUListElement} The suggestions `<ul>`.
     */
    #acList(root) {
        return root.querySelector(".aptitude-suggestions");
    }

    /**
     * Show the dropdown and apply the current filter.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     */
    #acOpen(root) {
        this.#acList(root)?.removeAttribute("hidden");
        this.#acFilter(root);
    }

    /**
     * Hide the dropdown and clear the active highlight.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     */
    #acClose(root) {
        const list = this.#acList(root);
        if (!list) return;
        list.setAttribute("hidden", "");
        list.querySelector(".aptitude-suggestion.active")?.classList.remove("active");
    }

    /**
     * Toggle the `hidden` CLASS (distinct from the list's `hidden` ATTRIBUTE) on
     * each suggestion so only those containing the input value remain. An empty
     * value shows the full list. If the active item is filtered out, clear it.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     */
    #acFilter(root) {
        const list = this.#acList(root);
        if (!list) return;
        const query = this.#acInput(root).value.trim().toLowerCase();
        for (const li of list.querySelectorAll(".aptitude-suggestion")) {
            const match = li.textContent.toLowerCase().includes(query);
            li.classList.toggle("hidden", !match);
            if (!match) li.classList.remove("active");
        }
    }

    /**
     * The currently visible (unfiltered) suggestions.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     * @returns {HTMLLIElement[]} The visible suggestion items.
     */
    #acItems(root) {
        return [...this.#acList(root).querySelectorAll(".aptitude-suggestion:not(.hidden)")];
    }

    /**
     * Move the single `active` highlight among visible items, wrapping around.
     * With nothing active, ArrowDown lands on the first item and ArrowUp on the
     * last. Keeps the active item scrolled into view.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     * @param {number} dir  +1 to move down, -1 to move up.
     */
    #acMove(root, dir) {
        const items = this.#acItems(root);
        if (!items.length) return;
        const current = items.findIndex(li => li.classList.contains("active"));
        let next;
        if (current === -1) {
            next = dir > 0 ? 0 : items.length - 1;
        } else {
            items[current].classList.remove("active");
            next = (current + dir + items.length) % items.length;
        }
        items[next].classList.add("active");
        items[next].scrollIntoView({ block: "nearest" });
    }

    /**
     * Commit a value: set the input, close the dropdown, then dispatch a single
     * bubbling `change`. Bubbling is load-bearing — the form's submitOnChange
     * listener only sees bubbling events; this one synthetic change drives
     * _processFormData -> save -> re-render.
     * @param {HTMLElement} root  The `.aptitude-autocomplete` wrapper.
     * @param {string} value  The value to commit (a localized label or free text).
     */
    #acCommit(root, value) {
        const input = this.#acInput(root);
        input.value = value;
        this.#acClose(root);
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /** @inheritDoc */
    _processFormData(event, form, formData) {
        // This runs BEFORE super._prepareSubmitData's validate(), which is
        // exactly why cleaning/normalizing the name here prevents the
        // blank-name DataModelValidationError. Keep it SYNCHRONOUS (the base
        // is sync; an async override would silently break saving).
        const data = super._processFormData(event, form, formData);
        if (typeof data?.name === "string") {
            const trimmed = data.name.trim();
            if (!trimmed) {
                // Cleared field: don't submit a blank name; the aptitude keeps
                // its current name. submitOnChange fires on the transient empty
                // value while the user clears the box to open the datalist, and
                // a blank Document name fails core validation.
                delete data.name;
            } else {
                // Build the reverse map per-call so localized labels track the
                // active locale. Anchor on the canonical English string first
                // (authoritative), then add each localized label; first-wins by
                // canonical order guards the (defensive) case of a label
                // collision. Mapped values -> canonical tag (no churn for
                // already-canonical input); unknown values pass through
                // unchanged so free text is preserved and saved. Look up on the
                // trimmed value so surrounding spaces still match.
                const reverse = {};
                for (const [canonical, key] of Object.entries(game.darkHeresy.config.aptitudes)) {
                    reverse[canonical] ??= canonical;
                    const label = game.i18n.localize(key);
                    reverse[label] ??= canonical;
                }
                data.name = reverse[trimmed] ?? data.name;
            }
        }
        return data;
    }
}

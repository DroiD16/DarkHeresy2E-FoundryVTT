import { DarkHeresyItemSheet } from "./item.js";

export class PsychicPowerSheet extends DarkHeresyItemSheet {
    static DEFAULT_OPTIONS = {
        classes: ["dark-heresy", "sheet", "psychic-power"],
        position: { height: 397 }
    };

    static PARTS = {
        form: {
            root: true,
            template: "systems/dark-heresy/template/sheet/psychic-power.hbs",
            templates: ["systems/dark-heresy/template/sheet/item/parts/effect-tab.hbs"]
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // {key, label} pairs for the Focus Power test dropdown. Each pair fills a
        // <li class="focus-suggestion" data-value="KEY">label</li>: the canonical
        // char/skill KEY is stored (locale-independent, resolved by
        // getFocusPowerTarget on every client), while the localized label is what
        // the user sees and types against. _processFormData reverse-maps a chosen
        // KEY or a typed localized label back to the canonical KEY on submit.
        // Only these curated keys are SUGGESTED in the dropdown; getFocusPowerTarget
        // still resolves any other valid characteristic/skill that is typed in, and
        // falls back to willpower only when nothing resolves. Labels come from the
        // full focusPowerTests map.
        const config = game.darkHeresy.config;
        context.focusTestSuggestions = config.focusPowerSuggestions
            .map(key => ({ key, label: game.i18n.localize(config.focusPowerTests[key]) }));
        return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        // Delegated listeners on the persistent window frame: this.element
        // survives part re-renders, so these bind ONCE and keep working after
        // every submitOnChange re-render. Each listener resolves the wrapper via
        // closest(".focus-autocomplete") and bails if the event is outside it, so
        // the rest of the sheet is ignored. Duplicated from the aptitude sheet
        // with focus-specific class names (zero regression risk to that feature).
        const element = this.element;

        // Open on pointerdown (NOT focusin): the programmatic focus-restoration
        // after a pick's re-render must not re-open the dropdown. Guard to the
        // input itself so a pointerdown on a <li> (also inside the wrapper) does
        // not pre-empt that li's mousedown -> commit. Do not preventDefault, so
        // focus proceeds normally.
        element.addEventListener("pointerdown", event => {
            const root = event.target.closest(".focus-autocomplete");
            if (!root) return;
            // The caret toggles the dropdown. preventDefault keeps focus from
            // being stolen (no blur churn), then focus the input and flip the
            // list's visibility: open when hidden, close when shown.
            if (event.target.closest(".focus-caret")) {
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
            const root = event.target.closest(".focus-autocomplete");
            if (!root || event.target !== this.#acInput(root)) return;
            const list = this.#acList(root);
            if (list?.hidden) this.#acOpen(root);
            else this.#acFilter(root);
        });

        element.addEventListener("keydown", event => {
            const root = event.target.closest(".focus-autocomplete");
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
                    // A highlighted suggestion commits its KEY (data-value); with
                    // none active, the typed text commits and is reverse-mapped.
                    event.preventDefault();
                    const active = list?.querySelector(".focus-suggestion.active:not(.hidden)");
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
        // before the click lands), then commit the picked suggestion's KEY.
        element.addEventListener("mousedown", event => {
            // The caret is a non-focusable <i>; its default mousedown would blur
            // the input, and that blur -> focusout -> #acClose would immediately
            // re-hide a list the pointerdown toggle just opened. preventDefault
            // here keeps focus on the input so the open toggle actually sticks.
            // The pointerdown handler already performed the open/close; nothing
            // else to do here.
            if (event.target.closest(".focus-caret")) {
                event.preventDefault();
                return;
            }
            const li = event.target.closest(".focus-suggestion");
            if (!li) return;
            const root = li.closest(".focus-autocomplete");
            if (!root) return;
            event.preventDefault();
            this.#acCommit(root, li.dataset.value);
        });

        // Leaving the wrapper hides the dropdown UI only. The native blur/change
        // is NOT blocked, so a free-text edit committed by clicking away still
        // fires its own change -> _processFormData -> save.
        element.addEventListener("focusout", event => {
            const root = event.target.closest(".focus-autocomplete");
            if (!root) return;
            this.#acClose(root);
        });
    }

    /**
     * The Focus Power test input inside an autocomplete wrapper. The field name
     * contains dots, so the attribute selector value MUST be quoted.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     * @returns {HTMLInputElement} The test input.
     */
    #acInput(root) {
        return root.querySelector("input[name=\"system.focusPower.test\"]");
    }

    /**
     * The suggestion list inside an autocomplete wrapper.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     * @returns {HTMLUListElement} The suggestions `<ul>`.
     */
    #acList(root) {
        return root.querySelector(".focus-suggestions");
    }

    /**
     * Show the dropdown and apply the current filter.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     */
    #acOpen(root) {
        this.#acList(root)?.removeAttribute("hidden");
        this.#acFilter(root);
    }

    /**
     * Hide the dropdown and clear the active highlight.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     */
    #acClose(root) {
        const list = this.#acList(root);
        if (!list) return;
        list.setAttribute("hidden", "");
        list.querySelector(".focus-suggestion.active")?.classList.remove("active");
    }

    /**
     * Toggle the `hidden` CLASS (distinct from the list's `hidden` ATTRIBUTE) on
     * each suggestion so only those containing the input value remain. An empty
     * value shows the full list. Matches against the visible localized labels.
     * If the active item is filtered out, clear it.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     */
    #acFilter(root) {
        const list = this.#acList(root);
        if (!list) return;
        const query = this.#acInput(root).value.trim().toLowerCase();
        for (const li of list.querySelectorAll(".focus-suggestion")) {
            const match = li.textContent.toLowerCase().includes(query);
            li.classList.toggle("hidden", !match);
            if (!match) li.classList.remove("active");
        }
    }

    /**
     * The currently visible (unfiltered) suggestions.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     * @returns {HTMLLIElement[]} The visible suggestion items.
     */
    #acItems(root) {
        return [...this.#acList(root).querySelectorAll(".focus-suggestion:not(.hidden)")];
    }

    /**
     * Move the single `active` highlight among visible items, wrapping around.
     * With nothing active, ArrowDown lands on the first item and ArrowUp on the
     * last. Keeps the active item scrolled into view.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
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
     * _processFormData -> save -> re-render. The committed value is either a
     * canonical KEY (suggestion pick) or the typed text (a localized label or
     * free text); _processFormData normalizes both to the stored KEY.
     * @param {HTMLElement} root  The `.focus-autocomplete` wrapper.
     * @param {string} value  The value to commit (a canonical KEY or typed text).
     */
    #acCommit(root, value) {
        const input = this.#acInput(root);
        input.value = value;
        this.#acClose(root);
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /** @inheritDoc */
    _processFormData(event, form, formData) {
        // Normalize the entered Focus Power test to the canonical char/skill KEY
        // before the base validate() runs. Keep it SYNCHRONOUS (the base is
        // sync; an async override would silently break saving). The base returns
        // an expanded object, so read/write the nested field via get/setProperty.
        const data = super._processFormData(event, form, formData);
        const value = foundry.utils.getProperty(data, "system.focusPower.test");
        if (typeof value === "string") {
            const trimmed = value.trim();
            // Empty is a LEGAL value here — store '' verbatim (no blank guard).
            if (!trimmed) {
                foundry.utils.setProperty(data, "system.focusPower.test", "");
            } else {
                // Build the reverse map per-call so localized labels track the
                // active locale. Anchor on the canonical KEY first (authoritative
                // for an already-stored value, e.g. re-saving an unchanged power),
                // then add each localized label -> KEY. A suggestion pick already
                // commits the KEY (maps to itself, no churn); a typed localized
                // label maps to its KEY; unknown free text passes through
                // unchanged so it is preserved and saved as-is.
                const reverse = {};
                for (const [key, labelKey] of Object.entries(game.darkHeresy.config.focusPowerTests)) {
                    reverse[key] ??= key;
                    reverse[game.i18n.localize(labelKey)] ??= key;
                }
                foundry.utils.setProperty(data, "system.focusPower.test", reverse[trimmed] ?? value);
            }
        }
        return data;
    }
}

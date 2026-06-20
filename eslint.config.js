/**
 * ESLint 9 flat configuration.
 *
 * Faithful migration of the former `.eslintrc.json`. The rule set is curated and
 * explicit: it intentionally does NOT extend `eslint:recommended` (or any preset),
 * because Foundry's runtime globals are undeclared and `no-undef` is deliberately
 * not enabled. Every rule below is ported verbatim from the legacy config with the
 * same severities and options.
 *
 * The legacy `env` block (browser/es2021/node/jquery) is reproduced via
 * `languageOptions.globals` using the `globals` package, and `parserOptions` is
 * replaced by `languageOptions` (parser object + sourceType + ecmaVersion).
 */
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import babelParser from "@babel/eslint-parser";

export default [
    // Global ignores. Must be the sole key in its config object so it applies
    // as a global ignore pattern rather than a per-file match.
    {
        ignores: ["node_modules/**", "css/**", "packs/**", "release/**"]
    },
    {
        files: ["script/**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
                ...globals.jquery
            }
        },
        plugins: {
            jsdoc
        },
        settings: {
            jsdoc: {
                preferredTypes: {
                    ".<>": "<>"
                },
                tagNamePreference: {
                    auguments: "extends"
                }
            }
        },
        rules: {
            "array-bracket-spacing": ["warn", "never"],
            "array-callback-return": "warn",
            "arrow-spacing": "warn",
            "comma-dangle": ["warn", "never"],
            "comma-style": "warn",
            "computed-property-spacing": "warn",
            "constructor-super": "error",
            "default-param-last": "warn",
            "dot-location": ["warn", "property"],
            "eol-last": ["error", "always"],
            "eqeqeq": ["warn", "smart"],
            "func-call-spacing": "warn",
            "func-names": ["warn", "never"],
            "getter-return": "warn",
            "lines-between-class-members": "warn",
            "new-parens": ["warn", "always"],
            "no-alert": "warn",
            "no-array-constructor": "warn",
            "no-class-assign": "warn",
            "no-compare-neg-zero": "warn",
            "no-cond-assign": "warn",
            "no-const-assign": "error",
            "no-constant-condition": "warn",
            "no-constructor-return": "warn",
            "no-delete-var": "warn",
            "no-dupe-args": "warn",
            "no-dupe-class-members": "warn",
            "no-dupe-keys": "warn",
            "no-duplicate-case": "warn",
            "no-duplicate-imports": ["warn", { includeExports: true }],
            "no-empty": ["warn", { allowEmptyCatch: true }],
            "no-empty-character-class": "warn",
            "no-empty-pattern": "warn",
            "no-func-assign": "warn",
            "no-global-assign": "warn",
            "no-implicit-coercion": ["warn", { allow: ["!!"] }],
            "no-implied-eval": "warn",
            "no-import-assign": "warn",
            "no-invalid-regexp": "warn",
            "no-irregular-whitespace": "warn",
            "no-iterator": "warn",
            "no-lone-blocks": "warn",
            "no-lonely-if": "warn",
            "no-loop-func": "warn",
            "no-misleading-character-class": "warn",
            "no-mixed-operators": "warn",
            "no-multi-str": "warn",
            "no-multiple-empty-lines": "warn",
            "no-new-func": "warn",
            "no-new-object": "warn",
            "no-new-symbol": "warn",
            "no-new-wrappers": "warn",
            "no-nonoctal-decimal-escape": "warn",
            "no-obj-calls": "warn",
            "no-octal": "warn",
            "no-octal-escape": "warn",
            "no-promise-executor-return": "warn",
            "no-proto": "warn",
            "no-regex-spaces": "warn",
            "no-script-url": "warn",
            "no-self-assign": "warn",
            "no-self-compare": "warn",
            "no-setter-return": "warn",
            "no-sequences": "warn",
            "no-template-curly-in-string": "warn",
            "no-this-before-super": "error",
            "no-unexpected-multiline": "warn",
            "no-unmodified-loop-condition": "warn",
            "no-unneeded-ternary": "warn",
            "no-unreachable": "warn",
            "no-unreachable-loop": "warn",
            "no-unsafe-negation": ["warn", { enforceForOrderingRelations: true }],
            "no-unsafe-optional-chaining": ["warn", { disallowArithmeticOperators: true }],
            "no-unused-expressions": "warn",
            "no-useless-backreference": "warn",
            "no-useless-call": "warn",
            "no-useless-catch": "warn",
            "no-useless-computed-key": ["warn", { enforceForClassMembers: true }],
            "no-useless-concat": "warn",
            "no-useless-constructor": "warn",
            "no-useless-rename": "warn",
            "no-useless-return": "warn",
            "no-var": "warn",
            "no-void": "warn",
            "no-whitespace-before-property": "warn",
            "prefer-numeric-literals": "warn",
            "prefer-object-spread": "warn",
            "prefer-regex-literals": "warn",
            "prefer-spread": "warn",
            "rest-spread-spacing": ["warn", "never"],
            "semi-spacing": "warn",
            "semi-style": ["warn", "last"],
            "space-unary-ops": ["warn", { words: true, nonwords: false }],
            "switch-colon-spacing": "warn",
            "symbol-description": "warn",
            "template-curly-spacing": ["warn", "never"],
            "unicode-bom": ["warn", "never"],
            "use-isnan": ["warn", { enforceForSwitchCase: true, enforceForIndexOf: true }],
            "valid-typeof": ["warn", { requireStringLiterals: true }],
            "wrap-iife": ["warn", "inside"],
            "arrow-parens": ["warn", "as-needed", { requireForBlockBody: false }],
            "capitalized-comments": ["warn", "always", { ignoreConsecutiveComments: true }],
            "comma-spacing": "warn",
            "dot-notation": "warn",
            "indent": ["warn", 4, { SwitchCase: 1 }],
            "key-spacing": "warn",
            "keyword-spacing": ["warn", { overrides: { catch: { before: true, after: false } } }],
            "max-len": ["warn", {
                code: 120,
                ignoreTrailingComments: true,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true
            }],
            "no-extra-boolean-cast": ["warn", { enforceForLogicalOperands: true }],
            "no-extra-semi": "warn",
            "no-multi-spaces": ["warn", { ignoreEOLComments: true }],
            "no-tabs": "warn",
            "no-throw-literal": "error",
            "no-trailing-spaces": "warn",
            "no-useless-escape": "warn",
            "no-unused-vars": ["warn", { args: "none" }],
            "nonblock-statement-body-position": ["warn", "beside"],
            "one-var": ["warn", "never"],
            "operator-linebreak": ["warn", "before", {
                overrides: { "=": "after", "+=": "after", "-=": "after" }
            }],
            "prefer-template": "warn",
            "quote-props": ["warn", "as-needed", { keywords: false }],
            "quotes": ["warn", "double", { avoidEscape: true, allowTemplateLiterals: false }],
            "semi": "warn",
            "space-before-blocks": ["warn", "always"],
            "space-before-function-paren": ["warn", {
                anonymous: "never",
                named: "never",
                asyncArrow: "always"
            }],
            "spaced-comment": "warn",
            "jsdoc/check-access": "warn",
            "jsdoc/check-alignment": "warn",
            "jsdoc/check-examples": "off",
            "jsdoc/check-indentation": "off",
            "jsdoc/check-line-alignment": "off",
            "jsdoc/check-param-names": "warn",
            "jsdoc/check-property-names": "warn",
            "jsdoc/check-syntax": "off",
            "jsdoc/check-tag-names": "warn",
            "jsdoc/check-types": "warn",
            "jsdoc/check-values": "warn",
            "jsdoc/empty-tags": "warn",
            "jsdoc/implements-on-classes": "warn",
            "jsdoc/match-description": "off",
            // `jsdoc/newline-after-description` was set to "off" in the legacy config and
            // was removed in eslint-plugin-jsdoc v48 (superseded by `jsdoc/tag-lines`).
            // It is omitted here: referencing a non-existent rule is a fatal config error,
            // and since it was disabled the omission has no behavioral effect.
            "jsdoc/no-bad-blocks": "warn",
            "jsdoc/no-defaults": "off",
            "jsdoc/no-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/require-description": "warn",
            "jsdoc/require-description-complete-sentence": "off",
            "jsdoc/require-example": "off",
            "jsdoc/require-file-overview": "off",
            "jsdoc/require-hyphen-before-param-description": ["warn", "never"],
            "jsdoc/require-jsdoc": "warn",
            "jsdoc/require-param": "warn",
            "jsdoc/require-param-description": "off",
            "jsdoc/require-param-name": "warn",
            "jsdoc/require-param-type": "warn",
            "jsdoc/require-property": "warn",
            "jsdoc/require-property-description": "off",
            "jsdoc/require-property-name": "warn",
            "jsdoc/require-property-type": "warn",
            "jsdoc/require-returns": "warn",
            "jsdoc/require-returns-check": "warn",
            "jsdoc/require-returns-description": "off",
            "jsdoc/require-returns-type": "warn",
            "jsdoc/require-throws": "off",
            "jsdoc/require-yields": "warn",
            "jsdoc/require-yields-check": "warn",
            "jsdoc/valid-types": "off"
        }
    }
];

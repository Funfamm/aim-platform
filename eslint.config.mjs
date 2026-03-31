import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── Plugin‑scoped rules that must be downgraded to "warn" ──────────
// These rules come from plugins bundled inside eslint-config-next
// (react, react-hooks, import).  We can only override them by
// patching the config objects that carry those plugins.
const PLUGIN_WARN_OVERRIDES = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/immutability": "warn",
  "react/no-unescaped-entities": "warn",
  "import/no-anonymous-default-export": "warn",
};

/** Patch every config object that defines any of the target rules. */
function downgradePluginRules(configs) {
  return configs.map((cfg) => {
    if (!cfg.rules) return cfg;
    const patched = { ...cfg.rules };
    let changed = false;
    for (const [rule, severity] of Object.entries(PLUGIN_WARN_OVERRIDES)) {
      if (rule in patched) {
        patched[rule] = severity;
        changed = true;
      }
    }
    return changed ? { ...cfg, rules: patched } : cfg;
  });
}

const eslintConfig = defineConfig([
  // Wrap Next.js configs with fixupConfigRules so that bundled
  // eslint-plugin-react v7 (which uses the deprecated getFilename API)
  // works correctly under ESLint 10.
  ...downgradePluginRules(fixupConfigRules(nextVitals)),
  ...downgradePluginRules(fixupConfigRules(nextTs)),

  // ── Standalone‑rule overrides ────────────────────────────────────
  // Downgrade high‑volume rules to "warn" so the CI pipeline can pass
  // while the backlog is addressed incrementally.  The --max-warnings
  // threshold prevents the count from growing.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

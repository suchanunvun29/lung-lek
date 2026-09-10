import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // T-UX-010 — turn on the FULL jsx-a11y recommended ruleset. eslint-config-next
  // already registers the plugin (with only a few rules enabled), so we add the
  // recommended rules against that existing plugin instead of redefining it.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The shared form primitives render native controls, so a <label> that
      // wraps <Select>/<Input>/<Textarea> is a real association. depth 4 lets
      // the rule see label text nested in wrapper divs/spans (radio cards,
      // toggle rows). Sibling label+control pairs still fail — they must use
      // htmlFor/id.
      "jsx-a11y/label-has-associated-control": [
        "error",
        {
          depth: 4,
          controlComponents: ["Select", "Input", "Textarea"],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

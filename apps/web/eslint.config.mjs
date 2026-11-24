import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pages load their data from the JSON API inside effects (loading/error state is set
      // at the start of each fetch). That is intentional here, so this is a warning.
      "react-hooks/set-state-in-effect": "warn",
      // Hard navigations are used deliberately after sign-out, 401 and account deletion
      // to drop all client state.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "preview/**"]),
]);

export default eslintConfig;

declare module "eslint-plugin-jsx-a11y" {
  import type { ESLint, Linter } from "eslint";

  interface JsxA11yPlugin extends ESLint.Plugin {
    readonly flatConfigs: {
      readonly recommended: Linter.Config;
      readonly strict: Linter.Config;
    };
  }

  const plugin: JsxA11yPlugin;
  export default plugin;
}

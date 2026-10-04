declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly REX_DEVTOOLS?: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const DEVTOOLS_ENV_KEY = "REX_DEVTOOLS";
export const DEVTOOLS_DEFINE = `import.meta.env.${DEVTOOLS_ENV_KEY}`;
export const DEVTOOLS_SHORTCUT = "mod+shift+d";
export const DEVTOOLS_AUDIT_PATH = "/rex/dev/audit";
export const DEVTOOLS_ATTRIBUTE = "data-rex-devtools";

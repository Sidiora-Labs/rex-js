import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RexCommand as Command } from "../args.ts";
import { RexError } from "../../core/errors.ts";
import { validateName } from "../../core/ids.ts";
import { titleFromId } from "../../core/page.ts";
import { REX_VERSION } from "../../index.ts";
import type { RexCliIO } from "../index.ts";
import {
  CLIENT_IMPORT,
  CORE_IMPORT,
  SERVER_IMPORT,
  configTemplate,
  actionTemplate,
  appPaths,
  entityTemplate,
  pageTemplate,
  policyTemplate,
  statesTemplate,
  viewTemplate,
} from "../templates.ts";
import { INVALID_ARGUMENT, MAKE_REFUSED, MakeError, writePlan, type PlannedEntry } from "./make.ts";
import { CONFIG_FILE, UI_KITS, type UiKit } from "../../core/config.ts";
import { runGenerators } from "../generators.ts";
import { InvalidArgumentError } from "../args.ts";
import {
  DesignxError,
  fetchDesignx,
  installPackages,
  type DesignxInstall,
  type DesignxOptions,
} from "../designx.ts";
import { DEFAULT_UI, isUiKit, type DesignxNewContext } from "../gen/designx.ts";

export { SERVER_IMPORT, configTemplate };
export const REX_PACKAGE = "@sidioralabs/rex";
export const APP_MODULE_TYPES = "rex-app.d.ts";
export { CONFIG_FILE };

export const HOME_PAGE = "home";
export const HOME_REGION = "welcome";
export const HOME_PART = "Welcome";
export const HOME_HOOK = "useNotes";
export const APP_ENTITY = "note";
export const APP_ACTION = "ping";
export const APP_POLICY = "viewer";
export const APP_DATA = "notes";
export const APP_COMPONENT = "Button";

export const APP_PEERS = [
  "@hono/node-server",
  "@tanstack/react-query",
  "@vitejs/plugin-react",
  "cmdk",
  "react",
  "react-dom",
  "vite",
  "wouter",
  "zod",
] as const;

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", "..", "..");
const viteDir = resolve(here, "..", "..", "vite");

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

function rexPackage(): PackageManifest {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as PackageManifest;
}

function versionOf(manifest: PackageManifest, name: string): string {
  const version =
    manifest.dependencies?.[name] ??
    manifest.devDependencies?.[name] ??
    manifest.peerDependencies?.[name];
  if (version === undefined) {
    throw new RexError("REX603", `rex new: ${REX_PACKAGE} does not pin a version of ${name}`);
  }
  return version;
}

export function appModuleTypesPath(): string {
  const fromPackage = relative(packageRoot, join(viteDir, APP_MODULE_TYPES)).split("\\").join("/");
  return `node_modules/${REX_PACKAGE}/${fromPackage}`;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function lines(...parts: readonly (string | readonly string[])[]): string {
  return `${parts.flat().join("\n")}\n`;
}

export function packageJsonTemplate(name: string): string {
  const rex = rexPackage();
  return json({
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "rex dev",
      build: "rex build",
      check: "rex check",
      manifest: "rex manifest",
      start: "node dist/server.js",
    },
    dependencies: Object.fromEntries([
      [REX_PACKAGE, `^${REX_VERSION}`],
      ...APP_PEERS.map((peer) => [peer, versionOf(rex, peer)]),
    ]),
    devDependencies: {
      "@types/node": versionOf(rex, "@types/node"),
      "@types/react": versionOf(rex, "@types/react"),
      "@types/react-dom": versionOf(rex, "@types/react-dom"),
      typescript: versionOf(rex, "typescript"),
    },
  });
}

export function tsconfigTemplate(): string {
  return json({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      moduleDetection: "force",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      jsx: "react-jsx",
      types: ["node"],
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      allowImportingTsExtensions: true,
      noEmit: true,
    },
    include: ["app", CONFIG_FILE, appModuleTypesPath()],
  });
}

export function indexHtmlTemplate(name: string): string {
  return lines(
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${titleFromId(name)}</title>`,
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    '    <script type="module" src="/@rex/entry"></script>',
    "  </body>",
    "</html>",
  );
}

export function dataTemplate(): string {
  return lines(
    `import { bind, memoryStore } from "${CORE_IMPORT}";`,
    `import { ${APP_ENTITY} } from "../entities/${APP_ENTITY}.ts";`,
    "",
    `export const ${APP_DATA} = bind(${APP_ENTITY}, memoryStore(${APP_ENTITY}, [{ id: "welcome", name: "Welcome to Rex" }]));`,
  );
}

export function componentTemplate(): string {
  return lines(
    'import type { ButtonHTMLAttributes } from "react";',
    "",
    `export default function ${APP_COMPONENT}(props: ButtonHTMLAttributes<HTMLButtonElement>) {`,
    '  return <button type="button" {...props} />;',
    "}",
  );
}

export function homeHookTemplate(): string {
  return lines(
    'import { useQuery } from "@tanstack/react-query";',
    `import { ${APP_DATA} } from "../../../data/${APP_DATA}.ts";`,
    "",
    `export function ${HOME_HOOK}() {`,
    "  return useQuery({",
    `    queryKey: [${JSON.stringify(APP_DATA)}],`,
    `    queryFn: async () => (await ${APP_DATA}.list()).items,`,
    "  });",
    "}",
  );
}

export function homeRegionTemplate(): string {
  return lines(
    `import { actionLabel, region } from "${CLIENT_IMPORT}";`,
    `import { ${APP_ACTION} } from "../../../../actions/${APP_ACTION}.ts";`,
    `import { ${HOME_HOOK} } from "../../hooks/${HOME_HOOK}.ts";`,
    `import ${HOME_PART} from "./parts/${HOME_PART}.tsx";`,
    "",
    `export default region(${JSON.stringify(HOME_REGION)}, ({ act }) => {`,
    `  const ${APP_DATA} = ${HOME_HOOK}();`,
    `  const handle = act(${APP_ACTION});`,
    "  return (",
    `    <${HOME_PART}`,
    `      notes={${APP_DATA}.data ?? []}`,
    "      actionLabel={actionLabel(handle.action)}",
    "      control={handle.controlProps}",
    "      onAction={() => {",
    "        void handle.run({});",
    "      }}",
    "    />",
    "  );",
    "});",
  );
}

export function homePartTemplate(): string {
  return lines(
    `import type { ActControlProps } from "${CLIENT_IMPORT}";`,
    `import ${APP_COMPONENT} from "../../../../../components/${APP_COMPONENT}.tsx";`,
    "",
    `export default function ${HOME_PART}(props: {`,
    "  readonly notes: readonly { readonly id: string; readonly name: string }[];",
    "  readonly actionLabel: string;",
    "  readonly control: ActControlProps;",
    "  readonly onAction: () => void;",
    "}) {",
    "  return (",
    "    <div>",
    "      <ul>",
    "        {props.notes.map((note) => (",
    "          <li key={note.id}>{note.name}</li>",
    "        ))}",
    "      </ul>",
    `      <${APP_COMPONENT} {...props.control} onClick={props.onAction}>`,
    "        {props.actionLabel}",
    `      </${APP_COMPONENT}>`,
    "    </div>",
    "  );",
    "}",
  );
}

function file(path: string, content: string): PlannedEntry {
  return { kind: "file", path, content };
}

function dir(path: string): PlannedEntry {
  return { kind: "dir", path };
}

export function newAppPlan(
  name: string,
  ui: UiKit = "none",
  designx: DesignxInstall | null = null,
): readonly PlannedEntry[] {
  const context: DesignxNewContext = { name, ui, designx };
  return runGenerators(context);
}

export function baseAppPlan(name: string): readonly PlannedEntry[] {
  const page = HOME_PAGE;
  return [
    file("package.json", packageJsonTemplate(name)),
    file("tsconfig.json", tsconfigTemplate()),
    file("index.html", indexHtmlTemplate(name)),
    file(CONFIG_FILE, configTemplate()),
    file(appPaths.entity(APP_ENTITY), entityTemplate({ name: APP_ENTITY })),
    file(appPaths.policy(APP_POLICY), policyTemplate({ name: APP_POLICY })),
    file(appPaths.action(APP_ACTION), actionTemplate({ name: APP_ACTION })),
    file(`app/data/${APP_DATA}.ts`, dataTemplate()),
    file(`app/components/${APP_COMPONENT}.tsx`, componentTemplate()),
    file(
      appPaths.page(page),
      pageTemplate({ id: page, route: "/", actions: [APP_ACTION], regions: [HOME_REGION] }),
    ),
    file(appPaths.view(page), viewTemplate({ page, regions: [HOME_REGION] })),
    file(appPaths.states(page), statesTemplate({ page })),
    file(appPaths.hook(page, HOME_HOOK), homeHookTemplate()),
    file(appPaths.region(page, HOME_REGION), homeRegionTemplate()),
    file(appPaths.part(page, HOME_REGION, HOME_PART), homePartTemplate()),
    dir(appPaths.testDir(page)),
  ];
}

function isNonEmptyDirectory(target: string): boolean {
  if (!existsSync(target)) return false;
  if (!statSync(target).isDirectory()) return true;
  return readdirSync(target).length > 0;
}

export interface NewAppOptions extends DesignxOptions {
  readonly ui?: UiKit;
  readonly install?: boolean;
}

export async function newApp(
  cwd: string,
  name: string,
  options: NewAppOptions = {},
): Promise<string[]> {
  let appName: string;
  try {
    appName = validateName(name, "app name");
  } catch (error) {
    throw new MakeError(INVALID_ARGUMENT, (error as Error).message);
  }
  const root = join(cwd, appName);
  if (isNonEmptyDirectory(root)) {
    throw new MakeError(
      MAKE_REFUSED,
      `refusing to write into ${appName}: it already exists and is not an empty folder`,
    );
  }
  const ui = options.ui ?? DEFAULT_UI;
  const designx = ui === "designx" ? await fetchDesignx(undefined, options) : null;
  const written = writePlan(root, newAppPlan(appName, ui, designx)).map(
    (path) => `${appName}/${path}`,
  );
  if (designx !== null && options.install !== false) installPackages(root);
  return written;
}

export function parseUi(value: string): UiKit {
  if (!isUiKit(value)) {
    throw new InvalidArgumentError(`--ui must be one of ${UI_KITS.join(", ")}`);
  }
  return value;
}

export function register(program: Command, io: RexCliIO): void {
  const command: Command = program
    .command("new")
    .description("write a complete Rex app into a new folder")
    .argument("<name>", "app name: lowercase letters, digits, dot and dash")
    .option("--ui <kit>", "UI kit: designx (default) or none", parseUi, DEFAULT_UI)
    .option("--no-install", "write the app without running the package manager install")
    .action(async (name: string, options: { ui: UiKit; install: boolean }) => {
      let written: string[];
      try {
        written = await newApp(io.cwd, name, { ui: options.ui, install: options.install });
      } catch (error) {
        if (error instanceof MakeError) {
          command.error(`rex new: ${error.detail}`, {
            code: error.cliCode,
            exitCode: error.exitCode,
          });
        }
        if (error instanceof DesignxError) {
          command.error(`rex new: ${error.message}`, {
            code: error.code,
            exitCode: error.exitCode,
          });
        }
        throw error;
      }
      for (const path of written) io.out(`wrote ${path}\n`);
    });
}

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { actor } from "../core/actor.ts";
import { EXIT_FAILURE, run, type RexCliIO } from "../cli/index.ts";
import type { Finding } from "./rule.ts";
import {
  GRANTED_ACTOR_ID,
  RUNTIME_RULE,
  compareRuntimeParity,
  defaultRuntimeActors,
  runRuntimeCheck,
  runtimeStates,
} from "./runtime.ts";
import { policy } from "../core/policy.ts";
import { page } from "../core/page.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const RUNTIME_TEST_TIMEOUT_MS = 240_000;

const DEPENDENCIES = [
  "@sidioralabs/rex",
  "@tanstack/react-query",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "cmdk",
  "react",
  "react-dom",
  "typescript",
  "vite",
  "wouter",
  "zod",
];

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function writeApp(name: string, files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), `rex-runtime-${name}-`));
  temporary.push(root);
  const all: Record<string, string> = {
    "package.json": `${JSON.stringify({ name, private: true, type: "module" }, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          noEmit: true,
        },
        include: ["app"],
      },
      null,
      2,
    )}\n`,
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  for (const dependency of DEPENDENCIES) {
    const source =
      dependency === "@sidioralabs/rex" ? packageRoot : join(packageRoot, "node_modules", dependency);
    expect(existsSync(source), `${dependency} is resolvable from the rex package`).toBe(true);
    const destination = join(root, "node_modules", dependency);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source), destination, "dir");
  }
  return root;
}

const GREET_ACTION = `import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const greet = action("greet", {
  input: z.object({}),
  output: z.object({ message: text() }),
  policy: always(),
  effect: "reversible",
  label: "Greet",
  handler: () => ({ message: "hello" }),
});
`;

const VAULT_POLICY = `import { policy } from "@sidioralabs/rex";

export const vault = policy("vault", {
  permissions: ["vault.open"],
  resolve: (actor) => (actor.permissions.includes("vault.open") ? ["vault.open"] : []),
});
`;

const OPEN_VAULT_ACTION = `import { action } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { vault } from "../policies/vault.ts";

export const openVault = action("open-vault", {
  input: z.object({}),
  output: z.object({ opened: text() }),
  policy: vault.can("vault.open"),
  effect: "reversible",
  label: "Open vault",
  handler: () => ({ opened: "yes" }),
});
`;

const passApp = {
  "app/actions/greet.ts": GREET_ACTION,
  "app/actions/open-vault.ts": OPEN_VAULT_ACTION,
  "app/policies/vault.ts": VAULT_POLICY,
  "app/pages/home/page.ts": `import { page } from "@sidioralabs/rex";
import { greet } from "../../actions/greet.ts";
import { openVault } from "../../actions/open-vault.ts";

export default page("home", {
  route: "/",
  actions: [greet, openVault],
  regions: ["main"],
  chrome: { title: "Home" },
  states: ["loading", "ready"],
});
`,
  "app/pages/home/view.tsx": `import { view } from "@sidioralabs/rex/client";
import MainRegion from "./regions/main/region.tsx";

export default view(() => <MainRegion />);
`,
  "app/pages/home/states.tsx": `export function Loading() {
  return <p>Loading home</p>;
}
`,
  "app/pages/home/regions/main/region.tsx": `import { region } from "@sidioralabs/rex/client";
import { greet } from "../../../../actions/greet.ts";
import { openVault } from "../../../../actions/open-vault.ts";

export default region("main", ({ act }) => {
  const hello = act(greet);
  const open = act(openVault);
  return (
    <div>
      <button type="button" {...hello.controlProps} onClick={() => void hello.run({})}>
        Greet
      </button>
      <button type="button" {...open.controlProps} onClick={() => void open.run({})}>
        Open vault
      </button>
    </div>
  );
});
`,
  "app/pages/vault/page.ts": `import { page } from "@sidioralabs/rex";
import { openVault } from "../../actions/open-vault.ts";
import { vault } from "../../policies/vault.ts";

export default page("vault", {
  route: "/vault",
  policy: vault.can("vault.open"),
  actions: [openVault],
  regions: ["controls"],
  chrome: { title: "Vault" },
  states: ["permission-denied", "ready"],
});
`,
  "app/pages/vault/view.tsx": `import { view } from "@sidioralabs/rex/client";
import ControlsRegion from "./regions/controls/region.tsx";

export default view(() => <ControlsRegion />);
`,
  "app/pages/vault/states.tsx": `export function PermissionDenied() {
  return <p>The vault is locked</p>;
}
`,
  "app/pages/vault/regions/controls/region.tsx": `import { region } from "@sidioralabs/rex/client";
import { openVault } from "../../../../actions/open-vault.ts";

export default region("controls", ({ act }) => {
  const open = act(openVault);
  return (
    <button type="button" {...open.controlProps} onClick={() => void open.run({})}>
      Open vault
    </button>
  );
});
`,
};

const failApp = {
  "app/actions/archive.ts": `import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const archive = action("archive", {
  input: z.object({}),
  output: z.object({ done: text() }),
  policy: always(),
  effect: "reversible",
  label: "Archive",
  handler: () => ({ done: "archived" }),
});
`,
  "app/actions/publish.ts": `import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const publish = action("publish", {
  input: z.object({}),
  output: z.object({ done: text() }),
  policy: always(),
  effect: "reversible",
  label: "Publish",
  handler: () => ({ done: "published" }),
});
`,
  "app/pages/board/page.ts": `import { page } from "@sidioralabs/rex";
import { archive } from "../../actions/archive.ts";
import { publish } from "../../actions/publish.ts";

export default page("board", {
  route: "/",
  actions: [publish, archive],
  regions: ["main"],
  chrome: { title: "Board" },
  states: ["empty", "ready"],
});
`,
  "app/pages/board/view.tsx": `import { view } from "@sidioralabs/rex/client";
import MainRegion from "./regions/main/region.tsx";

export default view(() => <MainRegion />);
`,
  "app/pages/board/states.tsx": `import { actionAttributes } from "@sidioralabs/rex/client";

export function Empty() {
  return (
    <button type="button" {...actionAttributes("board", "restore")}>
      Restore
    </button>
  );
}
`,
  "app/pages/board/regions/main/region.tsx": `import { actionAttributes, region } from "@sidioralabs/rex/client";
import { archive } from "../../../../actions/archive.ts";
import { publish } from "../../../../actions/publish.ts";

export default region("main", ({ act }) => {
  const publishing = act(publish);
  const archiving = act(archive);
  return (
    <div>
      <button type="button" {...publishing.controlProps} onClick={() => void publishing.run({})}>
        Publish
      </button>
      <button type="button" hidden {...archiving.controlProps}>
        Archive
      </button>
      <button type="button" {...actionAttributes("board", "ghost")}>
        Ghost
      </button>
    </div>
  );
});
`,
};

function captureIO(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RexCliIO = {
    cwd,
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

describe("runtime parity helpers", () => {
  it("derives an anonymous and a granted actor from the declared policies", () => {
    const vault = policy("vault", {
      permissions: ["vault.open", "vault.close"],
      resolve: () => [],
    });
    const actors = defaultRuntimeActors([vault]);
    expect(actors.map((subject) => subject.id)).toEqual(["anonymous", GRANTED_ACTOR_ID]);
    expect(actors[1]?.permissions).toEqual(["vault.close", "vault.open"]);
    expect(actors[1]?.attributes.unlocked).toBe(true);
  });

  it("mounts the declared states an actor can reach", () => {
    const declared = page("ledger", {
      route: "/ledger",
      states: ["loading", "permission-denied", "empty", "ready"],
    });
    expect(runtimeStates(declared, true)).toEqual(["loading", "empty", "ready"]);
    expect(runtimeStates(declared, false)).toEqual(["permission-denied"]);
  });

  it("reports listed actions without a visible control and visible controls without a listing", () => {
    const sidecar = {
      version: 1,
      page: "board",
      params: {},
      state: "ready",
      actions: [
        { id: "publish", label: "Publish", allowed: true, reason: null, effect: "reversible", input: {}, via: ["click", "palette", "url"] },
        { id: "archive", label: "Archive", allowed: false, reason: "never", effect: "reversible", input: {}, via: ["click", "palette", "url"] },
        { id: "flow-only", label: "Flow", allowed: true, reason: null, effect: "reversible", input: {}, via: ["url"] },
      ],
      overlays: [],
      outcome: null,
    } as const;
    const controls = [
      { address: "board/publish", visible: true, overlay: null },
      { address: "board/archive", visible: false, overlay: null },
      { address: "board/ghost", visible: true, overlay: null },
      { address: "board/hidden-ghost", visible: false, overlay: null },
    ];
    expect(compareRuntimeParity("board", sidecar as never, controls, true)).toEqual([
      { kind: "missing-control", subject: "archive" },
      { kind: "unlisted-control", subject: "board/ghost" },
    ]);
    expect(compareRuntimeParity("board", sidecar as never, controls, false)).toEqual([
      { kind: "unlisted-control", subject: "board/ghost" },
    ]);
  });
});

describe("rex check --runtime", () => {
  it(
    "mounts every page per actor and state and finds no gap in a consistent app",
    async () => {
      const root = writeApp("runtime-pass", passApp);
      const result = await runRuntimeCheck(root);
      expect(result.findings).toEqual([]);
      expect(result.exitCode).toBe(0);
      const mounts = result.mounts.map((mount) => `${mount.page} ${mount.actor} ${mount.state}`);
      expect(mounts).toEqual([
        "home anonymous loading",
        "home anonymous ready",
        `home ${GRANTED_ACTOR_ID} loading`,
        `home ${GRANTED_ACTOR_ID} ready`,
        "vault anonymous permission-denied",
        `vault ${GRANTED_ACTOR_ID} ready`,
      ]);
      const ready = result.mounts.find(
        (mount) => mount.page === "home" && mount.actor === "anonymous" && mount.state === "ready",
      );
      expect(ready?.actions).toEqual(["greet", "open-vault"]);
      expect(ready?.controls).toEqual(["home/greet", "home/open-vault"]);
      const loading = result.mounts.find(
        (mount) => mount.page === "home" && mount.actor === "anonymous" && mount.state === "loading",
      );
      expect(loading?.actions).toEqual(["greet", "open-vault"]);
      expect(loading?.controls).toEqual([]);
      const denied = result.mounts.find((mount) => mount.page === "vault" && mount.actor === "anonymous");
      expect(denied?.controls).toEqual([]);
      const granted = result.mounts.find(
        (mount) => mount.page === "vault" && mount.actor === GRANTED_ACTOR_ID,
      );
      expect(granted?.controls).toEqual(["vault/open-vault"]);
      for (const mount of result.mounts) {
        expect(mount.nav, `${mount.page} ${mount.actor} ${mount.state}`).toEqual(["home", "vault"]);
      }
      expect(ready?.controls).not.toContain("home");
    },
    RUNTIME_TEST_TIMEOUT_MS,
  );

  it(
    "mounts only the actors it is given",
    async () => {
      const root = writeApp("runtime-actors", passApp);
      const keyholder = actor({ id: "keyholder", permissions: ["vault.open"] });
      const result = await runRuntimeCheck(root, { actors: [keyholder] });
      expect(result.findings).toEqual([]);
      expect(result.mounts.map((mount) => `${mount.page} ${mount.actor} ${mount.state}`)).toEqual([
        "home keyholder loading",
        "home keyholder ready",
        "vault keyholder ready",
      ]);
    },
    RUNTIME_TEST_TIMEOUT_MS,
  );

  it(
    "reports sidecar actions without a visible control and controls without a sidecar entry",
    async () => {
      const root = writeApp("runtime-fail", failApp);
      const result = await runRuntimeCheck(root);
      expect(result.exitCode).toBe(1);
      const compact = (entry: Finding) => ({
        rule: entry.rule,
        severity: entry.severity,
        file: entry.file,
        line: entry.line,
        message: entry.message,
      });
      expect(result.findings.map(compact)).toEqual([
        {
          rule: RUNTIME_RULE,
          severity: "error",
          file: "app/pages/board/page.ts",
          line: 7,
          message: `the sidecar of page "board" lists action "archive" but no visible control carries data-rex="board/archive" (as anonymous in ready; as ${GRANTED_ACTOR_ID} in ready)`,
        },
        {
          rule: RUNTIME_RULE,
          severity: "error",
          file: "app/pages/board/regions/main/region.tsx",
          line: 1,
          message: `the control data-rex="board/ghost" on page "board" has no entry in the sidecar (as anonymous in ready; as ${GRANTED_ACTOR_ID} in ready)`,
        },
        {
          rule: RUNTIME_RULE,
          severity: "error",
          file: "app/pages/board/states.tsx",
          line: 1,
          message: `the control data-rex="board/restore" on page "board" has no entry in the sidecar (as anonymous in empty; as ${GRANTED_ACTOR_ID} in empty)`,
        },
      ]);
      const ready = result.mounts.find(
        (mount) => mount.actor === "anonymous" && mount.state === "ready",
      );
      expect(ready?.actions).toEqual(["publish", "archive"]);
      expect(ready?.controls).toEqual(["board/ghost", "board/publish"]);
      expect(ready?.nav).toEqual(["board"]);

      const cli = captureIO(root);
      const code = await run(["check", "--runtime", "--json"], cli.io);
      expect(code).toBe(EXIT_FAILURE);
      const reported = JSON.parse(cli.out()) as Finding[];
      const runtimeFindings = reported.filter((entry) => entry.rule === RUNTIME_RULE);
      expect(runtimeFindings).toEqual(result.findings.map((entry) => ({ ...entry })));
    },
    RUNTIME_TEST_TIMEOUT_MS,
  );
});

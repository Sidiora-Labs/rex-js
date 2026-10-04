import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ARGS_ERROR, RexArgsError, RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";
import { CLIENT_IMPORT, appPaths } from "../templates.ts";
import { MAKE_INVALID_CODE, MAKE_REFUSED_CODE, MakeError, makePage } from "./make.ts";
import { COMPONENTS_DIR, componentPath, parsePartPath, promotePart, register } from "./promote.ts";

const SPEC = "home/regions/welcome/parts/Welcome";
const PART = appPaths.part("home", "welcome", "Welcome");
const COMPONENT = "app/components/Welcome.tsx";
const HOME_REGION = appPaths.region("home", "welcome");
const INTRO_REGION = appPaths.region("about", "intro");
const HOME_HOOK = appPaths.hook("home", "useWelcome");
const HOME_VIEW = appPaths.view("home");

const PART_SOURCE = [
  'import type { ReactNode } from "react";',
  `import type { ActControlProps } from ${JSON.stringify(CLIENT_IMPORT)};`,
  'import Button from "../../../../../components/Button.tsx";',
  'import { format } from "./format.ts";',
  "",
  "export default function Welcome(props: {",
  "  readonly children?: ReactNode;",
  "  readonly control: ActControlProps;",
  "}) {",
  "  return <Button {...props.control}>{format(props.children)}</Button>;",
  "}",
  "",
].join("\n");

const MOVED_SOURCE = [
  'import type { ReactNode } from "react";',
  `import type { ActControlProps } from ${JSON.stringify(CLIENT_IMPORT)};`,
  'import Button from "./Button.tsx";',
  'import { format } from "../pages/home/regions/welcome/parts/format.ts";',
  "",
  "export default function Welcome(props: {",
  "  readonly children?: ReactNode;",
  "  readonly control: ActControlProps;",
  "}) {",
  "  return <Button {...props.control}>{format(props.children)}</Button>;",
  "}",
  "",
].join("\n");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

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

function write(root: string, file: string, lines: readonly string[]): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), `${lines.join("\n")}\n`);
}

function read(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

function appWithSharedPart(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-promote-"));
  temporary.push(root);
  makePage(root, { id: "home", regions: ["welcome"] });
  makePage(root, { id: "about", regions: ["intro"] });
  write(root, "app/components/Button.tsx", [
    'import type { ButtonHTMLAttributes } from "react";',
    "",
    "export default function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {",
    '  return <button type="button" {...props} />;',
    "}",
  ]);
  write(root, "app/pages/home/regions/welcome/parts/format.ts", [
    'import type { ReactNode } from "react";',
    "",
    "export function format(node: ReactNode): ReactNode {",
    "  return node;",
    "}",
  ]);
  writeFileSync(join(root, PART), PART_SOURCE);
  write(root, HOME_REGION, [
    `import { region } from ${JSON.stringify(CLIENT_IMPORT)};`,
    'import Welcome from "./parts/Welcome.tsx";',
    "",
    'export default region("welcome", ({ act }) => <Welcome control={act.controlProps} />);',
  ]);
  write(root, "app/pages/about/regions/intro/parts/Welcome.tsx", [
    "export default function Welcome() {",
    "  return <p>local</p>;",
    "}",
  ]);
  write(root, INTRO_REGION, [
    `import { region } from ${JSON.stringify(CLIENT_IMPORT)};`,
    'import Welcome from "../../../home/regions/welcome/parts/Welcome.tsx";',
    'import Local from "./parts/Welcome.tsx";',
    "",
    'export default region("intro", () => (',
    "  <>",
    "    <Welcome control={{}} />",
    "    <Local />",
    "  </>",
    "));",
  ]);
  write(root, HOME_HOOK, [
    "export function useWelcome() {",
    '  return () => import("../regions/welcome/parts/Welcome");',
    "}",
  ]);
  write(root, HOME_VIEW, [
    'export { default as Welcome } from "./regions/welcome/parts/Welcome.js";',
    "",
    "export default function HomeView() {",
    "  return null;",
    "}",
  ]);
  write(root, "app/node_modules/pkg/index.ts", [
    'export { default } from "../../pages/home/regions/welcome/parts/Welcome.tsx";',
  ]);
  write(root, "app/.cache/probe.ts", [
    'export { default } from "../pages/home/regions/welcome/parts/Welcome.tsx";',
  ]);
  return root;
}

function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("parsePartPath", () => {
  it("splits a part path into its page, region and part", () => {
    expect(parsePartPath(SPEC)).toEqual({ page: "home", region: "welcome", part: "Welcome" });
    expect(parsePartPath("send.review/regions/form/parts/AmountField")).toEqual({
      page: "send.review",
      region: "form",
      part: "AmountField",
    });
    expect(componentPath("Welcome")).toBe(COMPONENT);
    expect(COMPONENTS_DIR).toBe("app/components");
  });

  it("rejects malformed paths and invalid names as REX601", () => {
    expect(thrown(() => parsePartPath("home/parts/Welcome"))).toMatchObject({
      name: "MakeError",
      code: MAKE_INVALID_CODE,
      exitCode: 2,
      detail:
        '"home/parts/Welcome" is not a part path; expected <page>/regions/<region>/parts/<Part>',
    });
    expect(thrown(() => parsePartPath("home/regions/welcome/parts/welcome"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining("PascalCase"),
    });
    expect(thrown(() => parsePartPath("Home/regions/welcome/parts/Welcome"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining('invalid page id "Home"'),
    });
    expect(thrown(() => parsePartPath("home/regions/Welcome/parts/Welcome"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining('invalid region name "Welcome"'),
    });
    expect(thrown(() => parsePartPath(`${SPEC}.tsx`))).toBeInstanceOf(MakeError);
  });
});

describe("promotePart", () => {
  it("moves the part to app/components and rewrites every relative import of it", () => {
    const root = appWithSharedPart();
    const result = promotePart(root, SPEC);
    expect(result).toEqual({
      from: PART,
      to: COMPONENT,
      rewritten: [INTRO_REGION, HOME_HOOK, HOME_REGION, HOME_VIEW],
    });
    expect(existsSync(join(root, PART))).toBe(false);
    expect(read(root, COMPONENT)).toBe(MOVED_SOURCE);
    expect(read(root, HOME_REGION)).toContain(
      'import Welcome from "../../../../components/Welcome.tsx";',
    );
    expect(read(root, INTRO_REGION)).toContain(
      'import Welcome from "../../../../components/Welcome.tsx";',
    );
    expect(read(root, INTRO_REGION)).toContain('import Local from "./parts/Welcome.tsx";');
    expect(read(root, HOME_HOOK)).toContain('import("../../../components/Welcome")');
    expect(read(root, HOME_VIEW)).toContain(
      'export { default as Welcome } from "../../components/Welcome.js";',
    );
    expect(read(root, "app/node_modules/pkg/index.ts")).toContain(
      '"../../pages/home/regions/welcome/parts/Welcome.tsx"',
    );
    expect(read(root, "app/.cache/probe.ts")).toContain(
      '"../pages/home/regions/welcome/parts/Welcome.tsx"',
    );
    expect(existsSync(join(root, "app/pages/about/regions/intro/parts/Welcome.tsx"))).toBe(true);
  });

  it("refuses a missing part or an existing component and changes nothing", () => {
    const root = appWithSharedPart();
    expect(thrown(() => promotePart(root, "home/regions/welcome/parts/Missing"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      exitCode: 1,
      detail: `part home/regions/welcome/parts/Missing does not exist: ${appPaths.part("home", "welcome", "Missing")} is missing`,
    });

    write(root, COMPONENT, ["export default function Welcome() {}"]);
    expect(thrown(() => promotePart(root, SPEC))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail: `refusing to overwrite existing files:\n  ${COMPONENT}`,
    });
    expect(read(root, PART)).toBe(PART_SOURCE);
    expect(read(root, COMPONENT)).toBe("export default function Welcome() {}\n");
    expect(read(root, HOME_REGION)).toContain('import Welcome from "./parts/Welcome.tsx";');
  });
});

describe("register", () => {
  it("reports the move and each rewritten file, and maps make errors to usage errors", async () => {
    const root = appWithSharedPart();
    const captured = captureIO(root);
    const program = new RexCommand("rex").configureOutput({
      writeOut: captured.io.out,
      writeErr: captured.io.err,
    });
    register(program, captured.io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "promote", path: "rex promote", options: [] });
    expect(listing?.arguments.map((argument) => argument.name)).toEqual(["part"]);

    await expect(program.parseAsync(["promote", "home/parts/Welcome"])).rejects.toThrow(
      RexArgsError,
    );
    await expect(program.parseAsync(["promote", "home/parts/Welcome"])).rejects.toMatchObject({
      code: MAKE_INVALID_CODE,
      cliCode: ARGS_ERROR.invalidArgument,
      exitCode: 2,
      message: `${MAKE_INVALID_CODE} rex promote: "home/parts/Welcome" is not a part path; expected <page>/regions/<region>/parts/<Part>`,
    });
    expect(captured.out()).toBe("");

    await program.parseAsync(["promote", SPEC]);
    expect(captured.out()).toBe(
      [
        `moved ${PART} -> ${COMPONENT}`,
        `rewrote ${INTRO_REGION}`,
        `rewrote ${HOME_HOOK}`,
        `rewrote ${HOME_REGION}`,
        `rewrote ${HOME_VIEW}`,
        "",
      ].join("\n"),
    );
    await expect(program.parseAsync(["promote", SPEC])).rejects.toMatchObject({
      code: MAKE_REFUSED_CODE,
      exitCode: 1,
      message: expect.stringContaining(`rex promote: part ${SPEC} does not exist`),
    });
    expect(captured.err()).toBe("");
  });
});

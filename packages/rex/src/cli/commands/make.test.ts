import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { isRexError } from "../../core/errors.ts";
import { ARGS_ERROR, RexArgsError, RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";
import {
  actionTemplate,
  appPaths,
  entityTemplate,
  flowTemplate,
  hookTemplate,
  overlayTemplate,
  partTemplate,
  policyTemplate,
  regionTemplate,
} from "../templates.ts";
import {
  DECLARATION_KINDS,
  INVALID_ARGUMENT,
  MAKE_INVALID_CODE,
  MAKE_REFUSED,
  MAKE_REFUSED_CODE,
  MakeError,
  makeDeclaration,
  makeHook,
  makeOverlay,
  makePage,
  makePart,
  makeRegion,
  parseList,
  register,
  reportedMakeError,
  writePlan,
  type PlannedEntry,
} from "./make.ts";

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-make-command-"));
  temporary.push(root);
  return root;
}

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

function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

describe("MakeError", () => {
  it("maps the refusal and invalid-argument cli codes to REX codes and exit codes", () => {
    const refused = new MakeError(MAKE_REFUSED, "refusing to overwrite existing files");
    expect(refused).toBeInstanceOf(MakeError);
    expect(isRexError(refused)).toBe(true);
    expect(refused).toMatchObject({
      name: "MakeError",
      code: MAKE_REFUSED_CODE,
      cliCode: MAKE_REFUSED,
      exitCode: 1,
      detail: "refusing to overwrite existing files",
      message: `${MAKE_REFUSED_CODE} refusing to overwrite existing files`,
    });
    const invalid = new MakeError(INVALID_ARGUMENT, 'invalid page id "Send"');
    expect(invalid).toMatchObject({
      code: MAKE_INVALID_CODE,
      cliCode: ARGS_ERROR.invalidArgument,
      exitCode: 2,
      message: `${MAKE_INVALID_CODE} invalid page id "Send"`,
    });
    expect([MAKE_INVALID_CODE, MAKE_REFUSED_CODE]).toEqual(["REX601", "REX602"]);
  });
});

describe("writePlan", () => {
  it("writes files and directories in order and reports only what it created", () => {
    const root = tempRoot();
    mkdirSync(join(root, "app/pages/send/hooks"), { recursive: true });
    const entries: readonly PlannedEntry[] = [
      { kind: "file", path: "app/pages/send/page.ts", content: "export default 1;\n" },
      { kind: "dir", path: "app/pages/send/hooks" },
      { kind: "dir", path: "app/pages/send/test" },
      { kind: "file", path: "app/pages/send/regions/form/region.tsx", content: "region\n" },
    ];
    expect(writePlan(root, entries)).toEqual([
      "app/pages/send/page.ts",
      "app/pages/send/test/",
      "app/pages/send/regions/form/region.tsx",
    ]);
    expect(read(root, "app/pages/send/page.ts")).toBe("export default 1;\n");
    expect(read(root, "app/pages/send/regions/form/region.tsx")).toBe("region\n");
    expect(existsSync(join(root, "app/pages/send/test"))).toBe(true);
    expect(writePlan(root, [])).toEqual([]);
  });

  it("refuses when any planned file exists and writes nothing at all", () => {
    const root = tempRoot();
    mkdirSync(join(root, "app/entities"), { recursive: true });
    writeFileSync(join(root, "app/entities/token.ts"), "// kept\n");
    const entries: readonly PlannedEntry[] = [
      { kind: "file", path: "app/actions/send.ts", content: "send\n" },
      { kind: "dir", path: "app/flows" },
      { kind: "file", path: "app/entities/token.ts", content: "token\n" },
      { kind: "file", path: "app/policies/wallet.ts", content: "wallet\n" },
    ];
    writeFileSync(join(root, "app/entities/.keep"), "");
    mkdirSync(join(root, "app/policies"), { recursive: true });
    writeFileSync(join(root, "app/policies/wallet.ts"), "// mine\n");
    const error = thrown(() => writePlan(root, entries));
    expect(error).toBeInstanceOf(MakeError);
    expect(error).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail: [
        "refusing to overwrite existing files:",
        "  app/entities/token.ts",
        "  app/policies/wallet.ts",
      ].join("\n"),
    });
    expect(existsSync(join(root, "app/actions"))).toBe(false);
    expect(existsSync(join(root, "app/flows"))).toBe(false);
    expect(read(root, "app/entities/token.ts")).toBe("// kept\n");
    expect(read(root, "app/policies/wallet.ts")).toBe("// mine\n");
  });
});

describe("page file generators", () => {
  it("write a region, part, overlay and hook from the canonical templates", () => {
    const root = tempRoot();
    expect(makePage(root, { id: "send", regions: ["form"] })).toEqual([
      "app/pages/send/page.ts",
      "app/pages/send/view.tsx",
      "app/pages/send/states.tsx",
      "app/pages/send/hooks/",
      "app/pages/send/regions/form/region.tsx",
      "app/pages/send/test/",
    ]);
    expect(makeRegion(root, "send", "confirm")).toEqual([
      "app/pages/send/regions/confirm/region.tsx",
    ]);
    expect(makePart(root, "send", "form", "AmountField")).toEqual([
      "app/pages/send/regions/form/parts/AmountField.tsx",
    ]);
    expect(makeOverlay(root, "send", "TokenSheet")).toEqual([
      "app/pages/send/overlays/TokenSheet.tsx",
    ]);
    expect(makeHook(root, "send", "useDraft")).toEqual(["app/pages/send/hooks/useDraft.ts"]);
    expect(read(root, "app/pages/send/regions/confirm/region.tsx")).toBe(
      regionTemplate({ page: "send", name: "confirm" }),
    );
    expect(read(root, "app/pages/send/regions/form/parts/AmountField.tsx")).toBe(
      partTemplate({ name: "AmountField" }),
    );
    expect(read(root, "app/pages/send/overlays/TokenSheet.tsx")).toBe(
      overlayTemplate({ page: "send", name: "TokenSheet" }),
    );
    expect(read(root, "app/pages/send/hooks/useDraft.ts")).toBe(hookTemplate({ name: "useDraft" }));
  });

  it("require the owning page and region before writing", () => {
    const root = tempRoot();
    expect(thrown(() => makeRegion(root, "send", "form"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail: 'page "send" does not exist: app/pages/send/page.ts is missing',
    });
    expect(thrown(() => makeOverlay(root, "send", "TokenSheet"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail: 'page "send" does not exist: app/pages/send/page.ts is missing',
    });
    expect(thrown(() => makeHook(root, "send", "useDraft"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
    });
    makePage(root, { id: "send" });
    expect(thrown(() => makePart(root, "send", "form", "AmountField"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail:
        'region "send/form" does not exist: app/pages/send/regions/form/region.tsx is missing',
    });
    expect(existsSync(join(root, "app/pages/send/regions"))).toBe(false);
  });

  it("reject invalid names as REX601 before touching the file system", () => {
    const root = tempRoot();
    expect(thrown(() => makePage(root, { id: "Send" }))).toMatchObject({
      code: MAKE_INVALID_CODE,
      exitCode: 2,
      detail: expect.stringContaining('invalid page id "Send"'),
    });
    expect(thrown(() => makePage(root, { id: "send", overlays: ["sheet"] }))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining("PascalCase"),
    });
    expect(thrown(() => makeHook(root, "send", "draft"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining("use"),
    });
    expect(thrown(() => makePart(root, "send", "form", "amountField"))).toMatchObject({
      code: MAKE_INVALID_CODE,
    });
    expect(thrown(() => makeRegion(root, "send", "Form"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining("region name"),
    });
    expect(existsSync(join(root, "app"))).toBe(false);
  });
});

describe("declarations", () => {
  it("makeDeclaration writes each declaration kind at its conventional path", () => {
    const root = tempRoot();
    expect(DECLARATION_KINDS).toEqual(["action", "entity", "policy", "flow"]);
    expect(makeDeclaration(root, "action", "pick-token")).toEqual([appPaths.action("pick-token")]);
    expect(makeDeclaration(root, "entity", "token")).toEqual([appPaths.entity("token")]);
    expect(makeDeclaration(root, "policy", "wallet")).toEqual([appPaths.policy("wallet")]);
    expect(makeDeclaration(root, "flow", "payout")).toEqual([appPaths.flow("payout")]);
    expect(read(root, appPaths.action("pick-token"))).toBe(actionTemplate({ name: "pick-token" }));
    expect(read(root, appPaths.entity("token"))).toBe(entityTemplate({ name: "token" }));
    expect(read(root, appPaths.policy("wallet"))).toBe(policyTemplate({ name: "wallet" }));
    expect(read(root, appPaths.flow("payout"))).toBe(flowTemplate({ name: "payout" }));
    expect(thrown(() => makeDeclaration(root, "entity", "token"))).toMatchObject({
      code: MAKE_REFUSED_CODE,
      detail: `refusing to overwrite existing files:\n  ${appPaths.entity("token")}`,
    });
    expect(thrown(() => makeDeclaration(root, "flow", "pay out"))).toMatchObject({
      code: MAKE_INVALID_CODE,
      detail: expect.stringContaining('invalid flow id "pay out"'),
    });
  });

  it("parseList trims and drops empty items", () => {
    expect(parseList("hero, holdings ,,tail ")).toEqual(["hero", "holdings", "tail"]);
    expect(parseList("")).toEqual([]);
    expect(parseList(" , ")).toEqual([]);
  });
});

describe("reportedMakeError", () => {
  it("rewrites a MakeError as a usage error for the command and passes others through", () => {
    const refused = new MakeError(MAKE_REFUSED, "refusing to overwrite existing files:\n  a.ts");
    const reported = reportedMakeError("rex make", refused);
    expect(reported).toBeInstanceOf(RexArgsError);
    expect(reported).toMatchObject({
      message: `${MAKE_REFUSED_CODE} rex make: refusing to overwrite existing files:\n  a.ts`,
      cliCode: MAKE_REFUSED,
      exitCode: 1,
      code: MAKE_REFUSED_CODE,
    });
    const invalid = reportedMakeError("rex promote", new MakeError(INVALID_ARGUMENT, "bad"));
    expect(invalid).toMatchObject({
      message: `${MAKE_INVALID_CODE} rex promote: bad`,
      cliCode: ARGS_ERROR.invalidArgument,
      exitCode: 2,
      code: MAKE_INVALID_CODE,
    });
    const plain = new Error("disk full");
    expect(reportedMakeError("rex make", plain)).toBe(plain);
    expect(reportedMakeError("rex make", "text")).toBe("text");
  });
});

describe("register", () => {
  it("registers rex make with one subcommand per page file and declaration kind", async () => {
    const root = tempRoot();
    const captured = captureIO(root);
    const program = new RexCommand("rex").configureOutput({
      writeOut: captured.io.out,
      writeErr: captured.io.err,
    });
    register(program, captured.io);
    const [make] = program.listing().commands;
    expect(make?.path).toBe("rex make");
    expect(make?.commands.map((command) => command.name)).toEqual([
      "page",
      "region",
      "part",
      "overlay",
      "hook",
      ...DECLARATION_KINDS,
    ]);
    expect(make?.commands.find((command) => command.name === "flow")?.description).toBe(
      `write ${appPaths.flow("name")}`,
    );

    await program.parseAsync(["make", "page", "send", "--regions", "form"]);
    await program.parseAsync(["make", "part", "send", "AmountField", "--region", "form"]);
    expect(captured.out()).toBe(
      [
        "wrote app/pages/send/page.ts",
        "wrote app/pages/send/view.tsx",
        "wrote app/pages/send/states.tsx",
        "wrote app/pages/send/hooks/",
        "wrote app/pages/send/regions/form/region.tsx",
        "wrote app/pages/send/test/",
        "wrote app/pages/send/regions/form/parts/AmountField.tsx",
        "",
      ].join("\n"),
    );
    await expect(program.parseAsync(["make", "part", "send", "Row"])).rejects.toMatchObject({
      cliCode: ARGS_ERROR.missingMandatoryOptionValue,
    });
    await expect(program.parseAsync(["make", "region", "send", "form"])).rejects.toMatchObject({
      code: MAKE_REFUSED_CODE,
      exitCode: 1,
      message: `${MAKE_REFUSED_CODE} rex make: refusing to overwrite existing files:\n  app/pages/send/regions/form/region.tsx`,
    });
    await expect(program.parseAsync(["make", "entity", "Token"])).rejects.toMatchObject({
      code: MAKE_INVALID_CODE,
      exitCode: 2,
    });
    expect(captured.err()).toBe("");
  });
});

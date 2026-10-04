import { describe, expect, it } from "vitest";
import { ARGS_ERROR, InvalidArgumentError, RexArgsError, RexCommand } from "./args.ts";

interface Captured {
  readonly program: RexCommand;
  readonly calls: unknown[][];
  out(): string;
  err(): string;
}

function program(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  const calls: unknown[][] = [];
  const root = new RexCommand("tool")
    .description("a tool")
    .version("1.2.3", "-v, --version", "print the version")
    .configureOutput({ writeOut: (text) => out.push(text), writeErr: (text) => err.push(text) });
  root
    .command("serve")
    .description("serve files")
    .option("--port <port>", "port", (value) => {
      const port = Number(value);
      if (!Number.isInteger(port)) throw new InvalidArgumentError("the port must be an integer");
      return port;
    }, 3000)
    .option("--host <host>", "host")
    .option("--no-check", "skip the check")
    .option("-q, --quiet", "print less")
    .option("--tag <tag...>", "repeatable tag")
    .action((options: unknown) => {
      calls.push(["serve", options]);
    });
  const make = root.command("make").description("make things");
  make
    .command("page")
    .argument("<id>", "page id")
    .argument("[title]", "page title")
    .requiredOption("--layout <name>", "layout name")
    .option("--dry-run", "plan only")
    .action((id: string, title: string | undefined, options: unknown) => {
      calls.push(["make page", id, title, options]);
    });
  root.command("greet <name>").action((name: string) => {
    calls.push(["greet", name]);
  });
  return { program: root, calls, out: () => out.join(""), err: () => err.join("") };
}

async function failure(run: Promise<unknown>): Promise<RexArgsError> {
  try {
    await run;
  } catch (error) {
    expect(error).toBeInstanceOf(RexArgsError);
    return error as RexArgsError;
  }
  throw new Error("expected a RexArgsError");
}

describe("RexCommand parsing", () => {
  it("parses flags, values, defaults, negations, short flags and repeated flags", async () => {
    const tool = program();
    await tool.program.parseAsync(["serve", "--port", "8080", "--host=0.0.0.0", "-q", "--tag", "a", "--tag=b"]);
    await tool.program.parseAsync(["serve", "--no-check"]);
    expect(tool.calls).toEqual([
      ["serve", { port: 8080, host: "0.0.0.0", check: true, quiet: true, tag: ["a", "b"] }],
      ["serve", { port: 3000, check: false, tag: [] }],
    ]);
  });

  it("passes positionals, optional positionals and options to nested commands", async () => {
    const tool = program();
    await tool.program.parseAsync(["make", "page", "home", "--layout", "wide"]);
    await tool.program.parseAsync(["make", "page", "--dry-run", "about", "About us", "--layout=narrow"]);
    await tool.program.parseAsync(["greet", "--", "-rex"]);
    expect(tool.calls).toEqual([
      ["make page", "home", undefined, { layout: "wide" }],
      ["make page", "about", "About us", { layout: "narrow", dryRun: true }],
      ["greet", "-rex"],
    ]);
  });

  it.each([
    [["frobnicate"], ARGS_ERROR.unknownCommand, "unknown command 'frobnicate'"],
    [["--frobnicate"], ARGS_ERROR.unknownOption, "unknown option '--frobnicate'"],
    [["serve", "--nope"], ARGS_ERROR.unknownOption, "unknown option '--nope'"],
    [["serve", "--port"], ARGS_ERROR.optionMissingArgument, "argument missing"],
    [["serve", "--port", "x"], ARGS_ERROR.invalidArgument, "the port must be an integer"],
    [["serve", "--quiet=yes"], ARGS_ERROR.excessArguments, "takes no value"],
    [["serve", "extra"], ARGS_ERROR.excessArguments, "too many arguments"],
    [["make", "page", "--layout", "x"], ARGS_ERROR.missingArgument, "missing required argument 'id'"],
    [["make", "page", "home"], ARGS_ERROR.missingMandatoryOptionValue, "required option '--layout <name>'"],
    [["make"], ARGS_ERROR.missingCommand, "needs a command"],
  ])("rejects %j with exit code 2", async (argv, code, message) => {
    const tool = program();
    const error = await failure(tool.program.parseAsync(argv));
    expect(error.code).toBe(code);
    expect(error.exitCode).toBe(2);
    expect(error.message).toContain(message);
    expect(tool.calls).toEqual([]);
  });

  it("prints the version and help without running actions", async () => {
    const tool = program();
    await tool.program.parseAsync(["--version"]);
    await tool.program.parseAsync(["-v"]);
    expect(tool.out()).toBe("1.2.3\n1.2.3\n");
    await tool.program.parseAsync(["--help"]);
    const help = tool.out();
    expect(help).toContain("Usage: tool [options] [command]");
    expect(help).toContain("a tool");
    expect(help).toMatch(/^\s+-v, --version\s+print the version$/m);
    expect(help).toMatch(/^\s+serve \[options\]\s+serve files$/m);
    expect(help).toMatch(/^\s+make \[command\]\s+make things$/m);
    expect(help).toMatch(/^\s+greet <name>$/m);
    const sub = program();
    await sub.program.parseAsync(["make", "page", "-h"]);
    expect(sub.out()).toContain("Usage: tool make page [options] <id> [title]");
    expect(sub.out()).toContain("--layout <name>");
    expect(tool.calls).toEqual([]);
  });

  it("raises command errors with their own code and exit code", async () => {
    const root = new RexCommand("tool");
    root.command("fail").action(() => {
      root.error("tool: refused", { code: "tool.refused", exitCode: 1 });
    });
    const error = await failure(root.parseAsync(["fail"]));
    expect([error.message, error.code, error.exitCode]).toEqual(["tool: refused", "tool.refused", 1]);
  });

  it("refuses malformed declarations", () => {
    const root = new RexCommand("tool");
    expect(() => root.command("Bad")).toThrow(TypeError);
    root.command("ok");
    expect(() => root.command("ok")).toThrow(/twice/);
    expect(() => root.command("x").option("port", "no dashes")).toThrow(TypeError);
    expect(() => root.command("y").argument("name")).toThrow(TypeError);
    expect(() => root.command("z").argument("[a]").argument("<b>")).toThrow(/cannot follow/);
    expect(() => root.command("w").option("--no-color <c>")).toThrow(/takes no value/);
  });
});

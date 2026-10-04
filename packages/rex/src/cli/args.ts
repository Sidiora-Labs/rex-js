export const ARGS_ERROR = {
  unknownCommand: "rex.unknownCommand",
  unknownOption: "rex.unknownOption",
  missingCommand: "rex.missingCommand",
  missingArgument: "rex.missingArgument",
  excessArguments: "rex.excessArguments",
  invalidArgument: "rex.invalidArgument",
  optionMissingArgument: "rex.optionMissingArgument",
  missingMandatoryOptionValue: "rex.missingMandatoryOptionValue",
} as const;

export const ARGS_USAGE_EXIT = 2;

export class RexArgsError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code: string, exitCode: number = ARGS_USAGE_EXIT) {
    super(message);
    this.name = "RexArgsError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class InvalidArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgumentError";
  }
}

export type OptionParser = (value: string, previous: unknown) => unknown;

export type OptionValues = Record<string, unknown>;

export type CommandAction = (...args: never[]) => unknown;

export interface ArgsOutput {
  writeOut(text: string): void;
  writeErr(text: string): void;
}

interface OptionSpec {
  readonly flags: string;
  readonly short: string | null;
  readonly long: string;
  readonly key: string;
  readonly valueName: string | null;
  readonly repeat: boolean;
  readonly negate: boolean;
  readonly mandatory: boolean;
  readonly description: string;
  readonly parse: OptionParser | null;
  readonly defaultValue: unknown;
}

interface ArgumentSpec {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

const LONG_FLAG = /^--([a-z][a-z0-9-]*)$/;
const SHORT_FLAG = /^-([a-zA-Z])$/;
const VALUE = /^<([a-z][a-zA-Z0-9-]*)(\.\.\.)?>$/;
const ARGUMENT = /^(<|\[)([a-z][a-zA-Z0-9-]*)(>|\])$/;

function camelKey(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

function parseFlags(
  flags: string,
  description: string,
  parse: OptionParser | null,
  defaultValue: unknown,
  mandatory: boolean,
): OptionSpec {
  const parts = flags
    .split(/[ ,|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  let short: string | null = null;
  let long: string | null = null;
  let valueName: string | null = null;
  let repeat = false;
  for (const part of parts) {
    const shortMatch = SHORT_FLAG.exec(part);
    const longMatch = LONG_FLAG.exec(part);
    const valueMatch = VALUE.exec(part);
    if (shortMatch !== null && short === null) short = shortMatch[1] as string;
    else if (longMatch !== null && long === null) long = longMatch[1] as string;
    else if (valueMatch !== null && valueName === null) {
      valueName = valueMatch[1] as string;
      repeat = valueMatch[2] !== undefined;
    } else {
      throw new TypeError(`option flags ${JSON.stringify(flags)} cannot be parsed at "${part}"`);
    }
  }
  if (long === null) throw new TypeError(`option flags ${JSON.stringify(flags)} need a --long name`);
  const negate = long.startsWith("no-");
  if (negate && valueName !== null) {
    throw new TypeError(`option ${JSON.stringify(flags)} negates a flag and takes no value`);
  }
  const key = camelKey(negate ? long.slice("no-".length) : long);
  return {
    flags,
    short,
    long,
    key,
    valueName,
    repeat,
    negate,
    mandatory,
    description,
    parse,
    defaultValue: negate && defaultValue === undefined ? true : defaultValue,
  };
}

function pad(rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(0, ...rows.map(([left]) => left.length));
  return rows.map(([left, right]) =>
    right === "" ? `  ${left}` : `  ${left.padEnd(width)}  ${right}`,
  );
}

export class RexCommand {
  readonly commands: RexCommand[] = [];
  readonly #name: string;
  readonly #parent: RexCommand | null;
  #description = "";
  #version: { readonly value: string; readonly option: OptionSpec } | null = null;
  #action: CommandAction | null = null;
  #output: ArgsOutput | null = null;
  readonly #arguments: ArgumentSpec[] = [];
  readonly #options: OptionSpec[] = [];

  constructor(name: string, parent: RexCommand | null = null) {
    this.#name = name;
    this.#parent = parent;
  }

  name(): string {
    return this.#name;
  }

  command(nameAndArguments: string): RexCommand {
    const [name, ...argumentSpecs] = nameAndArguments.trim().split(/\s+/);
    if (name === undefined || !/^[a-z][a-z0-9-]*$/.test(name)) {
      throw new TypeError(`command name ${JSON.stringify(nameAndArguments)} is not valid`);
    }
    if (this.commands.some((command) => command.name() === name)) {
      throw new TypeError(`command "${name}" is registered twice`);
    }
    const command = new RexCommand(name, this);
    for (const spec of argumentSpecs) command.argument(spec);
    this.commands.push(command);
    return command;
  }

  description(text: string): this {
    this.#description = text;
    return this;
  }

  argument(spec: string, description = ""): this {
    const match = ARGUMENT.exec(spec);
    if (match === null || (match[1] === "<") !== (match[3] === ">")) {
      throw new TypeError(`argument ${JSON.stringify(spec)} must be <name> or [name]`);
    }
    const required = match[1] === "<";
    if (required && this.#arguments.some((argument) => !argument.required)) {
      throw new TypeError(`required argument ${spec} cannot follow an optional one`);
    }
    this.#arguments.push({ name: match[2] as string, required, description });
    return this;
  }

  option(flags: string, description?: string, parse?: OptionParser, defaultValue?: unknown): this;
  option(flags: string, description: string, defaultValue: unknown): this;
  option(flags: string, description = "", parseOrDefault?: unknown, defaultValue?: unknown): this {
    return this.#addOption(flags, description, parseOrDefault, defaultValue, false);
  }

  requiredOption(
    flags: string,
    description?: string,
    parse?: OptionParser,
    defaultValue?: unknown,
  ): this;
  requiredOption(flags: string, description: string, defaultValue: unknown): this;
  requiredOption(
    flags: string,
    description = "",
    parseOrDefault?: unknown,
    defaultValue?: unknown,
  ): this {
    return this.#addOption(flags, description, parseOrDefault, defaultValue, true);
  }

  #addOption(
    flags: string,
    description: string,
    parseOrDefault: unknown,
    defaultValue: unknown,
    mandatory: boolean,
  ): this {
    const parse = typeof parseOrDefault === "function" ? (parseOrDefault as OptionParser) : null;
    const fallback = parse === null ? parseOrDefault : defaultValue;
    const spec = parseFlags(flags, description, parse, fallback, mandatory);
    for (const existing of this.#allOptions()) {
      if (existing.long === spec.long || (spec.short !== null && existing.short === spec.short)) {
        throw new TypeError(`option ${flags} is declared twice`);
      }
    }
    this.#options.push(spec);
    return this;
  }

  version(value: string, flags = "-v, --version", description = "print the version"): this {
    this.#version = { value, option: parseFlags(flags, description, null, undefined, false) };
    return this;
  }

  action(handler: CommandAction): this {
    this.#action = handler;
    return this;
  }

  configureOutput(output: ArgsOutput): this {
    this.#output = output;
    return this;
  }

  error(message: string, options: { code?: string; exitCode?: number } = {}): never {
    throw new RexArgsError(message, options.code ?? "rex.error", options.exitCode ?? 1);
  }

  #allOptions(): OptionSpec[] {
    return this.#version === null ? [...this.#options] : [this.#version.option, ...this.#options];
  }

  #out(): ArgsOutput {
    if (this.#output !== null) return this.#output;
    if (this.#parent !== null) return this.#parent.#out();
    return {
      writeOut: (text) => process.stdout.write(text),
      writeErr: (text) => process.stderr.write(text),
    };
  }

  path(): string {
    return this.#parent === null ? this.#name : `${this.#parent.path()} ${this.#name}`;
  }

  usage(): string {
    const parts = [this.path(), "[options]"];
    if (this.commands.length > 0) parts.push("[command]");
    for (const argument of this.#arguments) {
      parts.push(argument.required ? `<${argument.name}>` : `[${argument.name}]`);
    }
    return parts.join(" ");
  }

  helpText(): string {
    const lines = [`Usage: ${this.usage()}`];
    if (this.#description !== "") lines.push("", this.#description);
    if (this.#arguments.length > 0) {
      lines.push(
        "",
        "Arguments:",
        ...pad(this.#arguments.map((argument) => [argument.name, argument.description])),
      );
    }
    const options: [string, string][] = this.#allOptions().map((option) => [
      option.flags,
      option.defaultValue === undefined || option.negate
        ? option.description
        : `${option.description} (default: ${JSON.stringify(option.defaultValue)})`,
    ]);
    options.push(["-h, --help", "display help for command"]);
    lines.push("", "Options:", ...pad(options));
    if (this.commands.length > 0) {
      lines.push(
        "",
        "Commands:",
        ...pad(
          this.commands.map((command) => {
            const left = [command.name()];
            if (command.#allOptions().length > 0) left.push("[options]");
            if (command.commands.length > 0) left.push("[command]");
            for (const argument of command.#arguments) {
              left.push(argument.required ? `<${argument.name}>` : `[${argument.name}]`);
            }
            return [left.join(" "), command.#description];
          }),
        ),
      );
    }
    return `${lines.join("\n")}\n`;
  }

  async parseAsync(argv: readonly string[]): Promise<void> {
    const options: OptionValues = {};
    for (const option of this.#options) {
      if (option.defaultValue !== undefined) options[option.key] = option.defaultValue;
      else if (option.repeat) options[option.key] = [];
    }
    const positionals: string[] = [];
    let index = 0;
    let literal = false;
    while (index < argv.length) {
      const token = argv[index] as string;
      index += 1;
      if (literal) {
        positionals.push(token);
        continue;
      }
      if (token === "--") {
        literal = true;
        continue;
      }
      if (token === "-h" || token === "--help") {
        this.#out().writeOut(this.helpText());
        return;
      }
      const version = this.#version;
      if (
        version !== null &&
        (token === `--${version.option.long}` ||
          (version.option.short !== null && token === `-${version.option.short}`))
      ) {
        this.#out().writeOut(`${version.value}\n`);
        return;
      }
      if (token.startsWith("-") && token.length > 1) {
        index = this.#readOption(argv, index, token, options);
        continue;
      }
      if (this.commands.length > 0 && positionals.length === 0 && this.#arguments.length === 0) {
        const command = this.commands.find((candidate) => candidate.name() === token);
        if (command === undefined) {
          throw new RexArgsError(`error: unknown command '${token}'`, ARGS_ERROR.unknownCommand);
        }
        await command.parseAsync(argv.slice(index));
        return;
      }
      positionals.push(token);
    }
    if (this.#action === null && this.commands.length > 0) {
      this.#out().writeErr(this.helpText());
      throw new RexArgsError(
        `error: ${this.path()} needs a command`,
        ARGS_ERROR.missingCommand,
      );
    }
    for (const option of this.#options) {
      if (option.mandatory && options[option.key] === undefined) {
        throw new RexArgsError(
          `error: required option '${option.flags}' not specified`,
          ARGS_ERROR.missingMandatoryOptionValue,
        );
      }
    }
    const values: (string | undefined)[] = [];
    for (const [position, argument] of this.#arguments.entries()) {
      const value = positionals[position];
      if (value === undefined && argument.required) {
        throw new RexArgsError(
          `error: missing required argument '${argument.name}'`,
          ARGS_ERROR.missingArgument,
        );
      }
      values.push(value);
    }
    if (positionals.length > this.#arguments.length) {
      throw new RexArgsError(
        `error: too many arguments for '${this.path()}'. Expected ${this.#arguments.length} argument${this.#arguments.length === 1 ? "" : "s"} but got ${positionals.length}.`,
        ARGS_ERROR.excessArguments,
      );
    }
    if (this.#action !== null) {
      await (this.#action as (...args: unknown[]) => unknown)(...values, options, this);
    }
  }

  #readOption(argv: readonly string[], index: number, token: string, options: OptionValues): number {
    const equals = token.indexOf("=");
    const flag = token.startsWith("--") && equals !== -1 ? token.slice(0, equals) : token;
    const inline = token.startsWith("--") && equals !== -1 ? token.slice(equals + 1) : undefined;
    const option = this.#options.find(
      (candidate) =>
        `--${candidate.long}` === flag ||
        (candidate.short !== null && `-${candidate.short}` === flag),
    );
    if (option === undefined) {
      throw new RexArgsError(`error: unknown option '${flag}'`, ARGS_ERROR.unknownOption);
    }
    if (option.valueName === null) {
      if (inline !== undefined) {
        throw new RexArgsError(
          `error: option '${option.flags}' takes no value`,
          ARGS_ERROR.excessArguments,
        );
      }
      options[option.key] = !option.negate;
      return index;
    }
    let next = index;
    let value = inline;
    if (value === undefined) {
      value = argv[next];
      next += 1;
    }
    if (value === undefined || (inline === undefined && value.startsWith("-") && value !== "-")) {
      throw new RexArgsError(
        `error: option '${option.flags}' argument missing`,
        ARGS_ERROR.optionMissingArgument,
      );
    }
    const previous = options[option.key];
    let parsed: unknown = value;
    if (option.parse !== null) {
      try {
        parsed = option.parse(value, previous);
      } catch (error) {
        if (error instanceof InvalidArgumentError) {
          throw new RexArgsError(
            `error: option '${option.flags}' argument '${value}' is invalid. ${error.message}`,
            ARGS_ERROR.invalidArgument,
          );
        }
        throw error;
      }
    }
    options[option.key] = option.repeat
      ? [...(Array.isArray(previous) ? (previous as unknown[]) : []), parsed]
      : parsed;
    return next;
  }
}

export function createCommand(name: string): RexCommand {
  return new RexCommand(name);
}

import { RexError } from "../../core/errors.ts";

export type MessageValue = string | number | boolean;

export type MessageValues = Readonly<Record<string, MessageValue>>;

export type MessageNode =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "arg"; readonly name: string }
  | { readonly kind: "number"; readonly name: string }
  | { readonly kind: "pound" }
  | {
      readonly kind: "plural";
      readonly name: string;
      readonly ordinal: boolean;
      readonly offset: number;
      readonly options: Readonly<Record<string, readonly MessageNode[]>>;
    }
  | {
      readonly kind: "select";
      readonly name: string;
      readonly options: Readonly<Record<string, readonly MessageNode[]>>;
    };

export class MessageFormatError extends RexError {
  readonly pattern: string;
  readonly position: number;

  constructor(pattern: string, position: number, problem: string) {
    super("REX317", `rex: message ${JSON.stringify(pattern)} at ${position}: ${problem}`);
    this.name = "MessageFormatError";
    this.pattern = pattern;
    this.position = position;
  }
}

const ARGUMENT_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const WHITESPACE = /\s/;

class MessageParser {
  readonly #source: string;
  #at = 0;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): readonly MessageNode[] {
    const nodes = this.#nodes(false, false);
    if (this.#at < this.#source.length) this.#fail("unmatched }");
    return nodes;
  }

  #fail(problem: string): never {
    throw new MessageFormatError(this.#source, this.#at, problem);
  }

  #skipSpace(): void {
    while (this.#at < this.#source.length && WHITESPACE.test(this.#source[this.#at] as string)) {
      this.#at++;
    }
  }

  #word(stops: string): string {
    this.#skipSpace();
    const start = this.#at;
    while (this.#at < this.#source.length) {
      const character = this.#source[this.#at] as string;
      if (stops.includes(character) || WHITESPACE.test(character)) break;
      this.#at++;
    }
    const word = this.#source.slice(start, this.#at);
    this.#skipSpace();
    return word;
  }

  #expect(character: string): void {
    if (this.#source[this.#at] !== character) this.#fail(`expected "${character}"`);
    this.#at++;
  }

  #quoted(inPlural: boolean): string | null {
    const source = this.#source;
    const next = source[this.#at + 1];
    if (next === "'") {
      this.#at += 2;
      return "'";
    }
    if (next !== "{" && next !== "}" && !(inPlural && next === "#")) return null;
    let text = "";
    this.#at++;
    while (this.#at < source.length) {
      const character = source[this.#at] as string;
      if (character === "'") {
        if (source[this.#at + 1] === "'") {
          text += "'";
          this.#at += 2;
          continue;
        }
        this.#at++;
        return text;
      }
      text += character;
      this.#at++;
    }
    return text;
  }

  #nodes(inPlural: boolean, nested: boolean): MessageNode[] {
    const source = this.#source;
    const nodes: MessageNode[] = [];
    let text = "";
    const flush = () => {
      if (text !== "") nodes.push({ kind: "text", value: text });
      text = "";
    };
    while (this.#at < source.length) {
      const character = source[this.#at] as string;
      if (character === "'") {
        const quoted = this.#quoted(inPlural);
        if (quoted === null) {
          text += "'";
          this.#at++;
        } else {
          text += quoted;
        }
        continue;
      }
      if (character === "{") {
        flush();
        nodes.push(this.#argument(inPlural));
        continue;
      }
      if (character === "}") {
        if (!nested) this.#fail("unmatched }");
        break;
      }
      if (character === "#" && inPlural) {
        flush();
        nodes.push({ kind: "pound" });
        this.#at++;
        continue;
      }
      text += character;
      this.#at++;
    }
    flush();
    return nodes;
  }

  #argument(inPlural: boolean): MessageNode {
    this.#expect("{");
    const name = this.#word(",}");
    if (!ARGUMENT_NAME.test(name)) this.#fail(`invalid argument name ${JSON.stringify(name)}`);
    if (this.#source[this.#at] === "}") {
      this.#at++;
      return { kind: "arg", name };
    }
    this.#expect(",");
    const type = this.#word(",}");
    if (type === "number") {
      this.#expect("}");
      return { kind: "number", name };
    }
    if (type !== "plural" && type !== "selectordinal" && type !== "select") {
      this.#fail(`unsupported argument type ${JSON.stringify(type)}`);
    }
    this.#expect(",");
    const plural = type !== "select";
    let offset = 0;
    this.#skipSpace();
    if (plural && this.#source.startsWith("offset:", this.#at)) {
      this.#at += "offset:".length;
      const raw = this.#word("{}");
      offset = Number(raw);
      if (!Number.isInteger(offset)) this.#fail(`invalid plural offset ${JSON.stringify(raw)}`);
    }
    const options: Record<string, readonly MessageNode[]> = {};
    for (;;) {
      this.#skipSpace();
      if (this.#at >= this.#source.length) this.#fail("unterminated argument");
      if (this.#source[this.#at] === "}") {
        this.#at++;
        break;
      }
      const selector = this.#word("{}");
      if (selector === "") this.#fail("expected a selector");
      if (Object.hasOwn(options, selector)) this.#fail(`duplicate selector ${selector}`);
      this.#expect("{");
      options[selector] = this.#nodes(plural || inPlural, true);
      this.#expect("}");
    }
    if (!Object.hasOwn(options, "other")) this.#fail(`${type} needs an "other" option`);
    return plural
      ? { kind: "plural", name, ordinal: type === "selectordinal", offset, options }
      : { kind: "select", name, options };
  }
}

const parsed = new Map<string, readonly MessageNode[]>();

export function parseMessage(pattern: string): readonly MessageNode[] {
  let nodes = parsed.get(pattern);
  if (nodes === undefined) {
    nodes = Object.freeze(new MessageParser(pattern).parse());
    parsed.set(pattern, nodes);
  }
  return nodes;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function numberFormat(locale: string): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format;
}

function pluralRule(locale: string, ordinal: boolean): Intl.PluralRules {
  const key = `${locale}|${ordinal ? "ordinal" : "cardinal"}`;
  let rules = pluralRules.get(key);
  if (rules === undefined) {
    rules = new Intl.PluralRules(locale, { type: ordinal ? "ordinal" : "cardinal" });
    pluralRules.set(key, rules);
  }
  return rules;
}

function missing(name: string): string {
  return `{${name}}`;
}

function formatNodes(
  nodes: readonly MessageNode[],
  values: MessageValues,
  locale: string,
  pound: number | null,
): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.value;
        break;
      case "pound":
        out += pound === null ? "#" : numberFormat(locale).format(pound);
        break;
      case "arg": {
        const value = values[node.name];
        if (value === undefined) out += missing(node.name);
        else out += typeof value === "number" ? numberFormat(locale).format(value) : String(value);
        break;
      }
      case "number": {
        const value = values[node.name];
        out += value === undefined ? missing(node.name) : numberFormat(locale).format(Number(value));
        break;
      }
      case "plural": {
        const value = values[node.name];
        if (value === undefined) {
          out += missing(node.name);
          break;
        }
        const count = Number(value);
        const exact = node.options[`=${count}`];
        const branch =
          exact ??
          (Number.isNaN(count)
            ? undefined
            : node.options[pluralRule(locale, node.ordinal).select(count - node.offset)]) ??
          (node.options.other as readonly MessageNode[]);
        out += formatNodes(branch, values, locale, count - node.offset);
        break;
      }
      case "select": {
        const value = values[node.name];
        if (value === undefined) {
          out += missing(node.name);
          break;
        }
        const branch = node.options[String(value)] ?? (node.options.other as readonly MessageNode[]);
        out += formatNodes(branch, values, locale, pound);
        break;
      }
    }
  }
  return out;
}

export function formatMessage(pattern: string, values: MessageValues = {}, locale = "en"): string {
  return formatNodes(parseMessage(pattern), values, locale, null);
}

import { createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RexError } from "../../core/errors.ts";

export type ElementPropKind = "string" | "number" | "boolean" | "json";

export type ElementPropMap<P> = { readonly [K in keyof P & string]?: ElementPropKind };

export interface DefineElementOptions<P> {
  readonly props: ElementPropMap<P>;
}

export interface RexElementConstructor extends CustomElementConstructor {
  readonly tagName: string;
  readonly observedAttributes: readonly string[];
}

const TAG_NAME = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;

export function attributeName(prop: string): string {
  return prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function coerceAttribute(
  tagName: string,
  attribute: string,
  kind: ElementPropKind,
  value: string | null,
): unknown {
  if (kind === "boolean") return value !== null && value !== "false";
  if (value === null) return undefined;
  if (kind === "string") return value;
  if (kind === "number") {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed)) {
      throw new RexError(
        "REX319",
        `rex: <${tagName}> attribute "${attribute}" is not a number: ${value}`,
      );
    }
    return parsed;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new RexError(
      "REX319",
      `rex: <${tagName}> attribute "${attribute}" is not JSON: ${value}`,
    );
  }
}

export function defineElement<P extends object>(
  tagName: string,
  Part: ComponentType<P>,
  options: DefineElementOptions<P>,
): RexElementConstructor {
  if (typeof tagName !== "string" || !TAG_NAME.test(tagName)) {
    throw new RexError(
      "REX319",
      `defineElement: "${String(tagName)}" is not a custom element name; use lowercase letters with a dash, for example rex-holding-row`,
    );
  }
  if (typeof Part !== "function" && (typeof Part !== "object" || Part === null)) {
    throw new RexError("REX319", `defineElement: <${tagName}> needs a part component`);
  }
  const Base = globalThis.HTMLElement;
  const registry = globalThis.customElements;
  if (Base === undefined || registry === undefined) {
    throw new RexError("REX327", `defineElement: <${tagName}> needs a DOM with customElements`);
  }
  if (registry.get(tagName) !== undefined) {
    throw new RexError("REX319", `defineElement: <${tagName}> is already defined`);
  }
  const entries = Object.entries(options?.props ?? {}).map(([prop, kind]) => {
    if (kind !== "string" && kind !== "number" && kind !== "boolean" && kind !== "json") {
      throw new RexError(
        "REX319",
        `defineElement: <${tagName}> prop "${prop}" has the unknown kind ${String(kind)}`,
      );
    }
    return { prop, attribute: attributeName(prop), kind: kind as ElementPropKind };
  });
  const observed = Object.freeze(entries.map((entry) => entry.attribute));

  class RexElement extends Base {
    static readonly tagName = tagName;
    static readonly observedAttributes = observed;

    #root: Root | null = null;

    #props(): P {
      const props: Record<string, unknown> = {};
      for (const { prop, attribute, kind } of entries) {
        const value = coerceAttribute(tagName, attribute, kind, this.getAttribute(attribute));
        if (value !== undefined) props[prop] = value;
      }
      return props as P;
    }

    #render(): void {
      if (this.#root === null) return;
      this.#root.render(createElement(Part, this.#props()));
    }

    connectedCallback(): void {
      if (this.#root === null) this.#root = createRoot(this);
      this.#render();
    }

    attributeChangedCallback(): void {
      this.#render();
    }

    disconnectedCallback(): void {
      const root = this.#root;
      if (root === null) return;
      queueMicrotask(() => {
        if (this.isConnected || this.#root !== root) return;
        this.#root = null;
        root.unmount();
      });
    }
  }

  registry.define(tagName, RexElement);
  return RexElement;
}

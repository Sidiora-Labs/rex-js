import type { HtmlTagDescriptor, Plugin } from "vite";
import { createNonce } from "../server/context.ts";

export const CSP_NONCE_META_PROPERTY = "csp-nonce";

const SCRIPT_OPEN_TAG =
  /<script((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*>/gi;
const ATTRIBUTE = /\s+([^\s"'>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

export function applyNonce(html: string, nonce: string): string {
  return html.replace(SCRIPT_OPEN_TAG, (tag, attributes: string) => {
    const kept: string[] = [];
    for (const match of attributes.matchAll(ATTRIBUTE)) {
      const name = (match[1] ?? "").toLowerCase();
      if (name === "src") return tag;
      if (name !== "nonce") kept.push(match[0]);
    }
    return `<script${kept.join("")} nonce="${nonce}">`;
  });
}

export function nonceMetaTag(nonce: string): HtmlTagDescriptor {
  return {
    tag: "meta",
    attrs: { property: CSP_NONCE_META_PROPERTY, nonce },
    injectTo: "head-prepend",
  };
}

export function nonceHook(): Plugin {
  return {
    name: "rex:nonce",
    apply: "serve",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const nonce = createNonce();
        return { html: applyNonce(html, nonce), tags: [nonceMetaTag(nonce)] };
      },
    },
  };
}

import { describe, expect, it } from "vitest";
import { generateEntryModule } from "../vite/entry-module.ts";
import { SSR_ROOT_ATTRIBUTE } from "../vite/prerender.ts";
import { SSR_ATTRIBUTE as HYDRATE_SSR_ATTRIBUTE } from "./hydrate.ts";
import { SSR_ATTRIBUTE } from "./ssr-attribute.ts";

describe("SSR_ATTRIBUTE", () => {
  it("names the attribute the server puts on a hydratable root and hydrate re-exports it", () => {
    expect(SSR_ATTRIBUTE).toBe("data-rex-ssr");
    expect(HYDRATE_SSR_ATTRIBUTE).toBe(SSR_ATTRIBUTE);
  });

  it("is the attribute the generated entry module tests before choosing to hydrate", () => {
    const source = generateEntryModule({
      client: "/app/node_modules/@sidioralabs/rex/src/client/index.ts",
    });
    const branch = source.split("\n").find((line) => line.startsWith("if ("));
    expect(branch).toBe(`if (container.hasAttribute(${JSON.stringify(SSR_ATTRIBUTE)})) {`);
    expect(source).toContain("startRexEntry(container, app,");
  });

  it("is what the prerender strips from a static page root", () => {
    expect(SSR_ROOT_ATTRIBUTE.source).toBe(` ${SSR_ATTRIBUTE}=""`);
    expect(`<div id="root" ${SSR_ATTRIBUTE}="">`.replace(SSR_ROOT_ATTRIBUTE, "")).toBe(
      '<div id="root">',
    );
    expect('<div id="root" data-rex-page="home">'.replace(SSR_ROOT_ATTRIBUTE, "")).toBe(
      '<div id="root" data-rex-page="home">',
    );
  });
});

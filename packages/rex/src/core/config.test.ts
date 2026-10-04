import { Hono } from "hono";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { action } from "./action.ts";
import { anonymousActor } from "./actor.ts";
import {
  CONFIG_FILE,
  DEFAULT_BUDGETS,
  DEFAULT_IMAGE_FORMATS,
  DEFAULT_IMAGE_SIZES,
  DEFAULT_OPTIONS,
  LEGACY_CONFIG_MESSAGE,
  RexConfigError,
  configServer,
  configServerOptions,
  defineConfig,
  isDefinedConfig,
  isFetchHandler,
  parseConfig,
  readConfigExport,
  resolveOptions,
  type RexConfigApp,
  type RexFetchHandler,
} from "./config.ts";
import { deprecationMessage, resetDeprecations } from "./deprecated.ts";
import { RexError, isRexError, type RexErrorCode } from "./errors.ts";
import { page } from "./page.ts";
import { always } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import * as configEntry from "../config.ts";
import * as rootEntry from "../index.ts";

const ping = action("ping", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "read",
  handler: () => ({ ok: true }),
});
const home = page("home", { route: "/", actions: [ping] });
const registry = createRegistry().register(ping, home).freeze();
const app = { name: "config-app", registry, pages: [] as const };

function serverFor(bundle: RexConfigApp): RexFetchHandler {
  return new Hono().get("/rex/name", (c) => c.text(bundle.name));
}

function rejection(run: () => unknown): { code: RexErrorCode; field: string; message: string } {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RexConfigError);
    expect(isRexError(error)).toBe(true);
    const failure = error as RexConfigError;
    return { code: failure.code, field: failure.field, message: failure.message };
  }
  throw new Error("expected a RexConfigError");
}

afterEach(() => {
  resetDeprecations();
});

describe("defineConfig", () => {
  it("returns a frozen, branded config that keeps the app and server", () => {
    const config = defineConfig({ app, server: serverFor });
    expect(Object.isFrozen(config)).toBe(true);
    expect(isDefinedConfig(config)).toBe(true);
    expect(isDefinedConfig({ app })).toBe(false);
    expect(config.app).toBe(app);
    expect(config.server).toBe(serverFor);
    expect(Object.keys(config).sort()).toEqual(["app", "server"]);
    expectTypeOf(config.app).toEqualTypeOf<typeof app>();
  });

  it("types the server argument as the declared app", () => {
    defineConfig({
      app,
      server: (bundle) => {
        expectTypeOf(bundle).toEqualTypeOf<typeof app>();
        return serverFor(bundle);
      },
    });
  });

  it("is exported from the rex/config entry only, not from the package root", () => {
    expect(configEntry.defineConfig).toBe(defineConfig);
    expect(Object.hasOwn(rootEntry, "defineConfig")).toBe(false);
    expect(Object.hasOwn(rootEntry, "parseConfig")).toBe(false);
    expect(configEntry.RexError).toBe(RexError);
  });
});

describe("parseConfig", () => {
  it("resolves every default", () => {
    const resolved = parseConfig({ app });
    expect(resolved.app).toBe(app);
    expect(resolved.server).toBeNull();
    expect(resolved.render).toEqual({ default: "ssr" });
    expect(resolved.budgets).toEqual({ core: 15, client: 30, page: 50 });
    expect(resolved.budgets).toBe(DEFAULT_BUDGETS);
    expect(resolved.security).toEqual({ csp: "strict", origins: [], headers: {}, secretNames: [] });
    expect(resolved.i18n).toBeNull();
    expect(resolved.images).toEqual({ sizes: DEFAULT_IMAGE_SIZES, formats: DEFAULT_IMAGE_FORMATS });
    expect(resolved.fonts).toEqual([]);
    expect(resolved.telemetry).toEqual({ tracer: null, logger: null });
    expect(resolved.ui).toBe("none");
    expect(resolved.shellComponents).toBeNull();
    expect(resolved.client).toEqual({ apiOrigin: null });
    expect(resolved.compiler).toBe(true);
    expect(resolved.devtools).toBe(true);
    expect(resolved.tailwind).toBe(false);
    expect(resolved.check).toEqual({
      tokens: { colors: [], spacing: [], classes: [] },
      i18n: { allow: [] },
    });
    const { app: _app, server: _server, ...options } = resolved;
    expect(options).toEqual(DEFAULT_OPTIONS);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it("resolves every declared option", () => {
    const logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
    const tracer = { startSpan: () => ({}) };
    const resolved = parseConfig(
      defineConfig({
        app,
        server: serverFor,
        render: { default: "csr" },
        budgets: { page: 80 },
        security: {
          csp: "report",
          origins: ["https://wallet.example.com", "http://localhost:5173"],
          headers: { "X-Frame-Options": "DENY" },
          secretNames: ["DATABASE_URL"],
        },
        i18n: { locales: ["en", "pt-BR"], default: "en", routing: "prefix" },
        images: { sizes: [1200, 640, 640], formats: ["webp"] },
        fonts: [
          { family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" },
          {
            family: "Mono",
            src: "https://cdn.example.com/mono.woff2",
            weight: 400,
            style: "italic",
            preload: false,
          },
        ],
        telemetry: { tracer, logger },
        ui: "designx",
        client: { apiOrigin: "https://api.example.com" },
        compiler: false,
        devtools: false,
        tailwind: true,
        check: {
          tokens: { colors: ["transparent"], classes: ["bg-*"] },
          i18n: { allow: ["Rex", "USD"] },
        },
      }),
    );
    expect(resolved.server).toBe(serverFor);
    expect(resolved.render.default).toBe("csr");
    expect(resolved.budgets).toEqual({ core: 15, client: 30, page: 80 });
    expect(resolved.security).toEqual({
      csp: "report",
      origins: ["https://wallet.example.com", "http://localhost:5173"],
      headers: { "x-frame-options": "DENY" },
      secretNames: ["DATABASE_URL"],
    });
    expect(resolved.i18n).toEqual({ locales: ["en", "pt-BR"], default: "en", routing: "prefix" });
    expect(resolved.images).toEqual({ sizes: [640, 1200], formats: ["webp"] });
    expect(resolved.fonts).toEqual([
      {
        family: "Inter",
        src: "/fonts/inter.woff2",
        weight: "100 900",
        style: "normal",
        preload: true,
      },
      {
        family: "Mono",
        src: "https://cdn.example.com/mono.woff2",
        weight: "400",
        style: "italic",
        preload: false,
      },
    ]);
    expect(resolved.telemetry.tracer).toBe(tracer);
    expect(resolved.telemetry.logger).toBe(logger);
    expect(resolved.ui).toBe("designx");
    expect(resolved.client.apiOrigin).toBe("https://api.example.com");
    expect([resolved.compiler, resolved.devtools, resolved.tailwind]).toEqual([false, false, true]);
    expect(resolved.check.tokens).toEqual({
      colors: ["transparent"],
      spacing: [],
      classes: ["bg-*"],
    });
    expect(resolved.check.i18n).toEqual({ allow: ["Rex", "USD"] });
    expect(resolved.i18n?.routing).toBe("prefix");
    expect(resolveOptions({ i18n: { locales: ["en"], default: "en" } }).i18n?.routing).toBe("none");
  });

  it("resolves ui as a kit name or as { kit, components } naming the app-wide shell components module", () => {
    expect(resolveOptions({ ui: "designx" })).toMatchObject({
      ui: "designx",
      shellComponents: null,
    });
    expect(
      resolveOptions({ ui: { kit: "designx", components: "app/components/shell.tsx" } }),
    ).toMatchObject({ ui: "designx", shellComponents: "app/components/shell.tsx" });
    expect(resolveOptions({ ui: { components: "app/components/chrome/shell.ts" } })).toMatchObject({
      ui: "none",
      shellComponents: "app/components/chrome/shell.ts",
    });
    expect(resolveOptions({ ui: {} })).toMatchObject({ ui: "none", shellComponents: null });
  });

  it.each([
    [{ app, edge: true }, "REX110", "edge"],
    [{ app: { name: "x" } }, "REX111", "app"],
    [{}, "REX111", "app"],
    [{ app, server: "hono" }, "REX112", "server"],
    [{ app, render: { default: "edge" } }, "REX113", "render.default"],
    [{ app, render: { mode: "ssr" } }, "REX113", "render.mode"],
    [{ app, budgets: { core: 0 } }, "REX114", "budgets.core"],
    [{ app, budgets: { page: "50" } }, "REX114", "budgets.page"],
    [{ app, security: { csp: "loose" } }, "REX115", "security.csp"],
    [
      { app, security: { origins: ["https://a.example.com/path"] } },
      "REX115",
      "security.origins.0",
    ],
    [{ app, security: { origins: ["ftp://a.example.com"] } }, "REX115", "security.origins.0"],
    [{ app, security: { origins: ["ws://a.example.com"] } }, "REX115", "security.origins.0"],
    [{ app, security: { origins: ["tauri://localhost/"] } }, "REX115", "security.origins.0"],
    [{ app, security: { origins: ["tauri:localhost"] } }, "REX115", "security.origins.0"],
    [{ app, security: { origins: ["javascript:alert(1)"] } }, "REX115", "security.origins.0"],
    [{ app, client: { apiOrigin: "tauri://localhost" } }, "REX121", "client.apiOrigin"],
    [
      { app, security: { headers: { "bad header": "x" } } },
      "REX115",
      "security.headers.bad header",
    ],
    [{ app, security: { secretNames: ["not-a-name"] } }, "REX115", "security.secretNames.0"],
    [{ app, i18n: { locales: [], default: "en" } }, "REX116", "i18n.locales"],
    [{ app, i18n: { locales: ["en"], default: "fr" } }, "REX116", "i18n.default"],
    [{ app, i18n: { locales: ["English"], default: "English" } }, "REX116", "i18n.locales.0"],
    [
      { app, i18n: { locales: ["en"], default: "en", routing: "domain" } },
      "REX116",
      "i18n.routing",
    ],
    [{ app, images: { sizes: [0] } }, "REX117", "images.sizes.0"],
    [{ app, images: { formats: ["gif"] } }, "REX117", "images.formats.0"],
    [{ app, fonts: [{ family: "Inter" }] }, "REX118", "fonts.0.src"],
    [{ app, fonts: [{ family: "Inter", src: "fonts/inter.woff2" }] }, "REX118", "fonts.0.src"],
    [
      { app, fonts: [{ family: "Inter", src: "/i.woff2", weight: "bold" }] },
      "REX118",
      "fonts.0.weight",
    ],
    [{ app, telemetry: { tracer: {} } }, "REX119", "telemetry.tracer"],
    [{ app, telemetry: { logger: { info: () => undefined } } }, "REX119", "telemetry.logger.debug"],
    [{ app, ui: "material" }, "REX120", "ui"],
    [{ app, ui: { kit: "material" } }, "REX120", "ui.kit"],
    [{ app, ui: { theme: "dark" } }, "REX120", "ui.theme"],
    [{ app, ui: { components: "app/pages/home/Shell.tsx" } }, "REX120", "ui.components"],
    [{ app, ui: { components: "app/components/../server/shell.ts" } }, "REX120", "ui.components"],
    [{ app, ui: { components: 7 } }, "REX120", "ui.components"],
    [{ app, client: { apiOrigin: "api.example.com" } }, "REX121", "client.apiOrigin"],
    [{ app, compiler: "yes" }, "REX122", "compiler"],
    [{ app, devtools: 1 }, "REX122", "devtools"],
    [{ app, tailwind: null }, "REX122", "tailwind"],
    [{ app, check: { tokens: { colors: "red" } } }, "REX123", "check.tokens.colors"],
    [{ app, check: { naming: {} } }, "REX123", "check.naming"],
    [{ app, check: { i18n: [] } }, "REX123", "check.i18n"],
    [{ app, check: { i18n: { allow: "Rex" } } }, "REX123", "check.i18n.allow"],
    [{ app, check: { i18n: { allow: ["Rex", ""] } } }, "REX123", "check.i18n.allow.1"],
    [{ app, check: { i18n: { deny: ["Rex"] } } }, "REX123", "check.i18n.deny"],
  ] as const)("rejects %j with %s naming %s", (value, code, field) => {
    const failure = rejection(() => parseConfig(value));
    expect(failure.code).toBe(code);
    expect(failure.field).toBe(field);
    expect(failure.message).toContain(`${code} ${CONFIG_FILE}: field "${field}"`);
  });

  it("admits app-scheme origins of desktop and mobile webviews in security.origins", () => {
    const origins = [
      "tauri://localhost",
      "capacitor://localhost",
      "http://tauri.localhost",
      "https://localhost",
    ];
    expect(parseConfig(defineConfig({ app, security: { origins } })).security.origins).toEqual(
      origins,
    );
    const failure = rejection(() =>
      parseConfig({ app, security: { origins: ["capacitor://localhost/index.html"] } }),
    );
    expect(failure.message).toContain("such as capacitor://localhost");
  });

  it("validates eagerly in defineConfig", () => {
    const failure = rejection(() => defineConfig({ app, render: { default: "edge" as "ssr" } }));
    expect(failure.code).toBe("REX113");
  });

  it("rejects a default export that is not an object", () => {
    expect(() => parseConfig("rex")).toThrow(RexError);
    try {
      parseConfig(42);
    } catch (error) {
      expect((error as RexError).code).toBe("REX102");
    }
  });
});

describe("readConfigExport and configServer", () => {
  it("serves through the declared server with the app bundle", async () => {
    const read = readConfigExport(defineConfig({ app, server: serverFor }));
    expect(read.kind).toBe("config");
    const server = configServer(read, () => {
      throw new Error("the fallback must not run when a server is declared");
    });
    const response = await server.fetch(new Request("http://rex.test/rex/name"));
    expect(await response.text()).toBe("config-app");
  });

  it("falls back to the default server when none is declared", async () => {
    const read = readConfigExport(defineConfig({ app }));
    const seen: string[] = [];
    const server = configServer(read, (bundle) => {
      seen.push(bundle.name);
      return serverFor(bundle);
    });
    expect(seen).toEqual(["config-app"]);
    expect(await (await server.fetch(new Request("http://rex.test/rex/name"))).text()).toBe(
      "config-app",
    );
  });

  it("hands the default server the config security and client options", () => {
    const security = { origins: ["tauri://localhost"], secretNames: ["API_KEY"] };
    const remote = readConfigExport(
      defineConfig({ app, security, client: { apiOrigin: "https://api.example.com" } }),
    );
    expect(configServerOptions(remote)).toEqual({
      security: {
        csp: "strict",
        origins: ["tauri://localhost"],
        headers: {},
        secretNames: ["API_KEY"],
      },
      client: { apiOrigin: "https://api.example.com" },
    });
    const local = configServerOptions(readConfigExport(defineConfig({ app })));
    expect(local).toEqual({ security: DEFAULT_OPTIONS.security });
    expect("client" in local).toBe(false);
    expect(resolveOptions(configServerOptions(remote)).security).toEqual(remote.options.security);
  });

  it("accepts a bare Hono app with a REX101 deprecation warned once", () => {
    const legacy = new Hono().get("/rex/health", (c) => c.json({ status: "ok" }));
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    const first = readConfigExport(legacy, warn);
    const second = readConfigExport(legacy, warn);
    expect(first.kind).toBe("legacy");
    expect(second.kind).toBe("legacy");
    expect(first.options).toBe(DEFAULT_OPTIONS);
    expect(configServer(first, () => serverFor(app))).toBe(legacy);
    expect(warnings).toEqual([deprecationMessage("REX101", LEGACY_CONFIG_MESSAGE)]);
    expect(warnings[0]).toContain("https://rex.sidioralabs.com/errors/REX101");
  });

  it("rejects a missing default export and a server that returns no fetch app", () => {
    expect(() => readConfigExport(undefined)).toThrow(/REX102/);
    const read = readConfigExport({ app, server: () => ({ anonymousActor }) });
    expect(() => configServer(read, serverFor)).toThrow(/REX112/);
    expect(isFetchHandler(new Hono())).toBe(true);
    expect(isFetchHandler({ fetch: "no" })).toBe(false);
  });

  it("keeps the page declarations reachable through the app registry", () => {
    const config = parseConfig({ app });
    expect(config.app.registry.find("page", "home")).toBe(home);
    expect(text().parse("x")).toBe("x");
  });
});

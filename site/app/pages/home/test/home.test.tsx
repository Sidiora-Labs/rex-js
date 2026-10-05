import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DECLARATION_KINDS,
  INVOCATION_ROUTES,
  REX_DATA_STATES,
  REX_ERROR_CATALOG,
  anonymousActor,
} from "@sidioralabs/rex";
import { defaultRules } from "@sidioralabs/rex/check";
import { DEFAULT_BUDGETS } from "@sidioralabs/rex/config";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { fireEvent, waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { readHomeMeta } from "../../../actions/home/read-home-meta.ts";
import { INSTALL_COMMANDS } from "../../../components/InstallBlock.tsx";
import { REPOSITORY_URL } from "../../../components/Shell.tsx";

setupRexTesting({ afterEach });

const REPOSITORY_ROOT = resolve(process.cwd(), "..");

function repositoryFile(path: string): string {
  return resolve(REPOSITORY_ROOT, path);
}

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(repositoryFile("packages/rex/package.json"), "utf8")) as {
    readonly version: string;
  }
).version;

const FACTS: Readonly<Record<string, string>> = {
  version: PACKAGE_VERSION,
  "error-codes": String(Object.keys(REX_ERROR_CATALOG).length),
  "checker-rules": String(defaultRules.length),
  "client-budget": String(DEFAULT_BUDGETS.client),
  "data-states": String(REX_DATA_STATES.length),
  "declaration-kinds": String(DECLARATION_KINDS.length),
  "invocation-routes": String(INVOCATION_ROUTES.length),
};

const HEADINGS: ReadonlyArray<readonly [region: string, level: number, text: string]> = [
  ["hero", 1, "The UI framework agents can operate"],
  ["pitch", 2, "One way to build it, one DOM to operate it"],
  ["primitives", 2, "Declarations and the manifest"],
  ["how-it-works", 2, "How an agent operates a Rex page"],
  ["install", 2, "Install"],
  ["features", 2, "Features"],
  ["live-sidecar", 2, "This page's own sidecar"],
  ["footer", 2, "Rex by Sidiora Labs"],
];

const SUBLINE =
  "Rex is Sidiora Labs' TypeScript framework for React application interfaces that AI agents write and AI agents operate, on a phone, a tablet or a desk.";

const FEATURES = [
  "rendering",
  "no-js",
  "targets",
  "states",
  "designx",
  "screen-fit",
  "errors",
  "testing",
  "i18n",
  "security",
  "telemetry",
  "budgets",
  "codemods",
];

const COPY_ID = "copy-addresses";

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

async function renderHome() {
  const view = await renderPage(siteApp(), "home");
  await waitFor(() => expect(view.sidecar().state).toBe("ready"));
  const main = await waitFor(() => {
    const found = view.container.querySelector<HTMLElement>('main[data-rex-page="home"]');
    if (found === null) throw new Error("the home page has no main element");
    for (const [region] of HEADINGS) {
      expect(found.querySelector(`[data-rex-region="home/${region}"]`), region).not.toBeNull();
    }
    expect(found.querySelector('[data-site-fact="version"]')).not.toBeNull();
    return found;
  });
  return { view, main };
}

function regionOf(main: HTMLElement, region: string): HTMLElement {
  const element = main.querySelector<HTMLElement>(`[data-rex-region="home/${region}"]`);
  if (element === null) throw new Error(`the home page has no region ${region}`);
  return element;
}

function normalized(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function textWords(root: HTMLElement): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const words: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    words.push(node.textContent ?? "");
  }
  return words.join(" ");
}

function firstHeading(file: string): string {
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("# "));
  return line === undefined ? "" : line.slice(2).trim();
}

function docFile(href: string): string {
  const recipe = /^\/docs\/recipes\/([a-z0-9-]+)$/.exec(href);
  if (recipe !== null) return repositoryFile(`docs/recipes/${recipe[1]}.md`);
  const doc = /^\/docs\/([a-z0-9-]+)$/.exec(href);
  if (doc !== null) return repositoryFile(`docs/${doc[1]}.md`);
  throw new Error(`${href} is not a doc route`);
}

function liveSidecarJson(main: HTMLElement): unknown {
  const code = main.querySelector('[data-site-live-sidecar] code[data-site-code-body="json"]');
  return JSON.parse(code?.textContent ?? "null") as unknown;
}

describe("home page", () => {
  it("declares the regions of the design in order, renders at build time and loads the facts", () => {
    const home = siteApp().page("home");
    expect(home.route).toBe("/");
    expect(home.render).toBe("ssg");
    expect(home.chrome.title).toBe("Home");
    expect(home.regions).toEqual(HEADINGS.map(([region]) => region));
    expect(home.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["meta", "read-home-meta"],
    ]);
  });

  it("reads every fact from its source in the code", async () => {
    expect(readHomeMeta.effect).toBe("read");
    expect(await readHomeMeta.handler({}, { actor: anonymousActor })).toEqual({
      version: PACKAGE_VERSION,
      errorCodes: Object.keys(REX_ERROR_CATALOG).length,
      checkerRules: defaultRules.length,
      clientBudgetKb: DEFAULT_BUDGETS.client,
      dataStates: REX_DATA_STATES.length,
      declarationKinds: [...DECLARATION_KINDS],
      invocationRoutes: [...INVOCATION_ROUTES],
    });
  });

  it("renders every region with its heading in the shell", async () => {
    const { main } = await renderHome();
    for (const [region, level, text] of HEADINGS) {
      expect(
        within(regionOf(main, region)).getByRole("heading", { level, name: text }),
      ).toBeTruthy();
    }
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("shows every number as the value read from its source", async () => {
    const { main } = await renderHome();
    for (const [fact, expected] of Object.entries(FACTS)) {
      const elements = [...main.querySelectorAll(`[data-site-fact="${fact}"]`)];
      expect(elements.length, fact).toBeGreaterThan(0);
      for (const element of elements) expect(element.textContent, fact).toBe(expected);
    }
    const prose = main.cloneNode(true) as HTMLElement;
    for (const element of prose.querySelectorAll("[data-site-fact], [data-site-live-sidecar]")) {
      element.remove();
    }
    expect(normalized(textWords(prose)).replace(/\bi18n\b/g, "")).not.toMatch(/\d/);
  });

  it("renders the hero with the mark, the tagline and the subline", async () => {
    const { main } = await renderHome();
    const hero = regionOf(main, "hero");
    const marks = [...hero.querySelectorAll("[data-site-mark] img")];
    expect(marks.map((image) => image.getAttribute("src"))).toEqual([
      "/mark-light.png",
      "/mark-dark.png",
    ]);
    expect(within(hero).getByText(SUBLINE)).toBeTruthy();
    const ctas = [...hero.querySelectorAll<HTMLAnchorElement>("a[data-site-cta]")];
    expect(ctas.map((link) => [link.dataset.siteCta, link.getAttribute("href")])).toEqual([
      ["tutorial", "/docs/tutorial"],
      ["docs", "/docs"],
      ["github", REPOSITORY_URL],
    ]);
    expect(existsSync(repositoryFile("docs/tutorial.md"))).toBe(true);
  });

  it("names the rules of the README and the declarations of the package", async () => {
    const { main } = await renderHome();
    const rules = [...regionOf(main, "pitch").querySelectorAll<HTMLElement>("[data-site-rule]")];
    expect(
      rules.map((rule) => within(rule).getByRole("heading", { level: 3 }).textContent),
    ).toEqual([
      "One declaration per capability",
      "One folder convention per page",
      "One checker",
      "One DOM that humans and agents operate",
    ]);
    const readme = readFileSync(repositoryFile("README.md"), "utf8");
    for (const rule of rules) {
      const title = within(rule).getByRole("heading", { level: 3 }).textContent ?? "";
      expect(readme).toContain(`**${title}.**`);
    }
    const declarations = [
      ...regionOf(main, "primitives").querySelectorAll<HTMLElement>("[data-site-declaration]"),
    ].map((card) => card.dataset.siteDeclaration);
    expect(declarations).toEqual([...DECLARATION_KINDS, "manifest"]);
  });

  it("explains the addresses and lists the invocation routes of the protocol", async () => {
    const { main } = await renderHome();
    const region = regionOf(main, "how-it-works");
    const attributes = [...region.querySelectorAll<HTMLElement>("[data-site-attribute]")].map(
      (row) => row.dataset.siteAttribute,
    );
    expect(attributes).toEqual([
      "data-rex-page",
      "data-rex-region",
      "data-rex",
      "data-rex-allowed",
      "data-rex-overlay",
      "data-rex-nav",
      "data-rex-palette-item",
      "script#rex-page",
    ]);
    const contract = readFileSync(repositoryFile("docs/agent-contract.md"), "utf8");
    for (const attribute of attributes.filter((name) => name?.startsWith("data-rex"))) {
      expect(contract).toMatch(new RegExp(`\`${attribute}(?:\`|=)`));
    }
    const routes = [...region.querySelectorAll<HTMLElement>("[data-site-route]")].map(
      (card) => card.dataset.siteRoute,
    );
    expect(routes).toEqual([...INVOCATION_ROUTES]);
  });

  it("links every feature card to the doc page it names", async () => {
    const { main } = await renderHome();
    const cards = [
      ...regionOf(main, "features").querySelectorAll<HTMLElement>("[data-site-feature]"),
    ];
    expect(cards.map((card) => card.dataset.siteFeature)).toEqual(FEATURES);
    for (const card of cards) {
      const link = card.querySelector<HTMLAnchorElement>("a[data-site-doc]");
      expect(link, card.dataset.siteFeature).not.toBeNull();
      const file = docFile(link?.getAttribute("href") ?? "");
      expect(existsSync(file), file).toBe(true);
      expect(firstHeading(file)).toBe(link?.dataset.siteDoc);
    }
  });

  it("renders the install block with the version of the package", async () => {
    const { main } = await renderHome();
    const install = regionOf(main, "install");
    const code = install.querySelector('[data-site-install] code[data-site-code-body="sh"]');
    expect(code?.textContent).toBe(INSTALL_COMMANDS.join("\n"));
    expect(INSTALL_COMMANDS).toEqual([
      "pnpm dlx @sidioralabs/rex new my-app",
      "cd my-app",
      "pnpm rex dev",
    ]);
    const versions = [...install.querySelectorAll("[data-site-fact=version]")];
    expect(versions.map((element) => element.textContent)).toEqual([
      PACKAGE_VERSION,
      PACKAGE_VERSION,
    ]);
    expect(normalized(install.textContent)).toContain(
      `Rex ${PACKAGE_VERSION} is published to npm with the release.`,
    );
  });

  it("renders the footer with the repository, license and Sidiora Labs links", async () => {
    const { main } = await renderHome();
    const footer = regionOf(main, "footer");
    const links = new Map(
      [...footer.querySelectorAll<HTMLAnchorElement>("a[data-site-footer-link]")].map((link) => [
        link.dataset.siteFooterLink,
        link.getAttribute("href"),
      ]),
    );
    expect(links.get("repository")).toBe(REPOSITORY_URL);
    expect(links.get("license")).toBe(`${REPOSITORY_URL}/blob/main/LICENSE`);
    expect(existsSync(repositoryFile("LICENSE"))).toBe(true);
    expect(links.get("sidiora")).toBe("https://github.com/Sidiora-Labs");
  });

  it("lists the copy action in the sidecar and addresses its control", async () => {
    const { view, main } = await renderHome();
    await waitFor(() =>
      expect(view.sidecar().actions.filter((entry) => entry.id === COPY_ID)).toEqual([
        {
          id: COPY_ID,
          label: "Copy addresses",
          allowed: true,
          reason: null,
          effect: "read",
          input: { type: "object", properties: {}, additionalProperties: false },
          via: ["click", "palette"],
        },
      ]),
    );
    expect(view.sidecar().actions.map((entry) => entry.id)).toEqual([COPY_ID, "toggle-theme"]);
    const control = regionOf(main, "live-sidecar").querySelector(`[data-rex="home/${COPY_ID}"]`);
    expect(control).not.toBeNull();
    expect(control?.getAttribute("data-rex-allowed")).toBe("true");
    expect(control?.textContent).toBe("Copy addresses");
  });

  it("shows the page's own sidecar and keeps it equal to the sidecar script", async () => {
    const { view, main } = await renderHome();
    await waitFor(() =>
      expect(view.sidecar().actions.map((entry) => entry.id)).toEqual([COPY_ID, "toggle-theme"]),
    );
    await waitFor(() => expect(liveSidecarJson(main)).toEqual(view.sidecar()));
    const caption = normalized(
      regionOf(main, "live-sidecar").querySelector("figcaption")?.textContent ?? null,
    );
    expect(caption).toContain('main[data-rex-page="home"]');
    expect(caption).toContain("script#rex-page");
    expect(caption).toContain("application/rex+json");
  });

  it("copies the page, region and action addresses and records the outcome", async () => {
    const { view, main } = await renderHome();
    const control = await waitFor(() => {
      const found = main.querySelector<HTMLElement>(`[data-rex="home/${COPY_ID}"]`);
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await waitFor(() =>
      expect(view.sidecar().actions.map((entry) => entry.id)).toEqual([COPY_ID, "toggle-theme"]),
    );
    fireEvent.click(control);
    const expected = [
      "home",
      ...HEADINGS.map(([region]) => `home/${region}`),
      `home/${COPY_ID}`,
      "home/toggle-theme",
    ];
    await waitFor(() => expect(view.sidecar().outcome?.action).toBe(COPY_ID));
    expect(view.sidecar().outcome?.ok).toBe(true);
    expect(view.sidecar().outcome?.message).toBe(
      `Copy addresses succeeded: ${expected.length} addresses copied`,
    );
    expect(await globalThis.navigator.clipboard.readText()).toBe(expected.join("\n"));
    await waitFor(() => expect(liveSidecarJson(main)).toEqual(view.sidecar()));
  });

  it("navigates from the shell with data-rex-nav and marks home current", async () => {
    const { view } = await renderHome();
    const link = view.container.querySelector('[data-rex-nav="home"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("renders the shell with the mark, the GitHub link and the theme toggle", async () => {
    const { view } = await renderHome();
    expect(view.container.querySelector("[data-site-brand] [data-site-mark]")).not.toBeNull();
    const github = view.container.querySelector("[data-site-github]");
    expect(github?.getAttribute("href")).toBe(REPOSITORY_URL);
    expect(view.container.querySelector("[data-site-theme-toggle]")).not.toBeNull();
    const toggle = view.container.querySelector<HTMLElement>('[data-rex="home/toggle-theme"]');
    expect(toggle).not.toBeNull();
    expect(view.sidecar().actions.find((entry) => entry.id === "toggle-theme")).toMatchObject({
      allowed: true,
      effect: "reversible",
      via: ["click", "palette"],
    });
    const before = toggle?.getAttribute("data-site-theme-toggle");
    fireEvent.click(toggle as HTMLElement);
    await waitFor(() =>
      expect(toggle?.getAttribute("data-site-theme-toggle")).toBe(
        before === "dark" ? "light" : "dark",
      ),
    );
    expect(view.sidecar().outcome).toMatchObject({ action: "toggle-theme", ok: true });
  });

  it("renders a region alone on the page runtime", async () => {
    const view = await renderRegion(siteApp(), "home", "install");
    await waitFor(() => expect(view.sidecar().state).toBe("loading"));
    expect(view.sidecar().actions.find((entry) => entry.id === COPY_ID)).toMatchObject({
      allowed: false,
      reason: "Requires an active browser control",
    });
    const install = await waitFor(() => {
      const found = view.container.querySelector<HTMLElement>('[data-rex-region="home/install"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await waitFor(() =>
      expect(install.querySelector("[data-site-fact=version]")?.textContent).toBe(PACKAGE_VERSION),
    );
    expect(view.container.querySelector('[data-rex-region="home/hero"]')).toBeNull();
  });
});

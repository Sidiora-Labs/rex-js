import { expect, test, type Page } from "@playwright/test";
import {
  MIN_AGENT_HIT_TARGET,
  SIDECAR_SELECTOR,
  STEP_TIMEOUT,
  buildDemo,
  committedManifest,
  openOverlay,
  pageUrl,
  startDemo,
  type ManifestPage,
  type RenderMode,
  type RunningDemo,
  type SidecarPayload,
} from "./walk.ts";

const committed = committedManifest();
const EXTERNAL_DEMO_URL = "REX_DEMO_URL";
const DEFAULT_DENSITY = "comfortable";
const PRERENDER_MODES: readonly RenderMode[] = ["ssg", "static"];
const PRERENDER_NAV_FORM = "sidebar";
const CONTROL_SELECTOR =
  "[data-rex], [data-rex-nav], [data-rex-overlay-trigger], [data-rex-palette-trigger]";

type NavForm = "bar" | "sidebar" | "dock";
type SheetForm = "dialog" | "bottom-sheet";

interface ScreenExpectation {
  readonly screen: "phone" | "tablet" | "desktop";
  readonly pointer: "coarse" | "fine";
  readonly nav: NavForm;
  readonly sheet: SheetForm;
}

const PROJECTS: Readonly<Record<string, ScreenExpectation>> = {
  phone: { screen: "phone", pointer: "coarse", nav: "dock", sheet: "bottom-sheet" },
  tablet: { screen: "tablet", pointer: "coarse", nav: "bar", sheet: "dialog" },
  desktop: { screen: "desktop", pointer: "fine", nav: "sidebar", sheet: "dialog" },
};

interface ScreenFields {
  readonly screen?: string;
  readonly pointer?: string;
  readonly density?: string;
}

type ScreenSidecar = SidecarPayload & ScreenFields;

interface RootScreen {
  readonly screen: string | null;
  readonly pointer: string | null;
  readonly density: string | null;
}

interface Widths {
  readonly inner: number;
  readonly document: number;
  readonly body: number;
}

interface ControlSize {
  readonly address: string;
  readonly width: number;
  readonly height: number;
}

interface NavLink {
  readonly address: string;
  readonly current: boolean;
  readonly visible: boolean;
  readonly height: number;
}

interface NavState {
  readonly forms: readonly string[];
  readonly visible: boolean;
  readonly left: number;
  readonly right: number;
  readonly links: readonly NavLink[];
}

function expectationFor(project: string): ScreenExpectation {
  const found = PROJECTS[project];
  if (found === undefined)
    throw new Error(`playwright project ${project} has no screen expectation`);
  return found;
}

function prerendered(pageInfo: ManifestPage): boolean {
  return PRERENDER_MODES.includes(pageInfo.render);
}

let demo: RunningDemo | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const external = process.env[EXTERNAL_DEMO_URL];
  if (external !== undefined && external !== "") {
    demo = { url: external, stop: () => Promise.resolve() };
    return;
  }
  buildDemo();
  demo = await startDemo();
});

test.afterAll(async () => {
  await demo?.stop();
  demo = null;
});

function base(): string {
  if (demo === null) throw new Error("the demo server is not running");
  return demo.url;
}

async function documentSidecar(page: Page, pageId: string): Promise<ScreenSidecar> {
  await page.waitForFunction(
    ([selector, id]) => {
      const found = document.querySelectorAll(selector);
      if (found.length !== 1) return false;
      try {
        const payload = JSON.parse(found[0]?.textContent ?? "") as {
          page?: string;
          state?: string;
        };
        return payload.page === id && payload.state === "ready";
      } catch {
        return false;
      }
    },
    [SIDECAR_SELECTOR, pageId] as const,
    { timeout: STEP_TIMEOUT },
  );
  const text = await page.evaluate(
    (selector) => document.querySelector(selector)?.textContent ?? "",
    SIDECAR_SELECTOR,
  );
  return JSON.parse(text) as ScreenSidecar;
}

async function rootScreen(page: Page): Promise<RootScreen> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      screen: root.getAttribute("data-rex-screen"),
      pointer: root.getAttribute("data-rex-pointer"),
      density: root.getAttribute("data-rex-density"),
    };
  });
}

async function widths(page: Page): Promise<Widths> {
  return page.evaluate(() => ({
    inner: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
}

async function visibleControls(page: Page): Promise<ControlSize[]> {
  return page.evaluate((selector) => {
    const found: ControlSize[] = [];
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const address =
        element.getAttribute("data-rex") ??
        element.getAttribute("data-rex-nav") ??
        element.getAttribute("data-rex-overlay-trigger") ??
        element.getAttribute("data-rex-palette-trigger") ??
        "";
      found.push({ address, width: rect.width, height: rect.height });
    }
    return found;
  }, CONTROL_SELECTOR);
}

async function navigation(page: Page): Promise<NavState> {
  return page.evaluate(() => {
    const navs = [...document.querySelectorAll("[data-rex-nav-form]")];
    const nav = navs[0];
    const rect = nav?.getBoundingClientRect();
    const links =
      nav === undefined
        ? []
        : [...nav.querySelectorAll("[data-rex-nav]")].map((link) => {
            const box = link.getBoundingClientRect();
            return {
              address: link.getAttribute("data-rex-nav") ?? "",
              current: link.getAttribute("aria-current") === "page",
              visible: box.width > 0 && box.height > 0,
              height: box.height,
            };
          });
    return {
      forms: navs.map((element) => element.getAttribute("data-rex-nav-form") ?? ""),
      visible: rect !== undefined && rect.width > 0 && rect.height > 0,
      left: rect?.left ?? 0,
      right: rect?.right ?? 0,
      links,
    };
  });
}

function small(controls: readonly ControlSize[]): string[] {
  return controls
    .filter((entry) => entry.width < MIN_AGENT_HIT_TARGET || entry.height < MIN_AGENT_HIT_TARGET)
    .map((entry) => `${entry.address} ${String(entry.width)}x${String(entry.height)}`);
}

for (const listed of committed.pages) {
  test(`page ${listed.id} fits the screen`, async ({ page }, info) => {
    const expected = expectationFor(info.project.name);
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error(`project ${info.project.name} sets no viewport`);
    const screen = { screen: expected.screen, pointer: expected.pointer, density: DEFAULT_DENSITY };

    await page.goto(pageUrl(base(), listed.route, {}));
    const payload = await documentSidecar(page, listed.id);
    await page.evaluate(() => document.fonts.ready);

    expect(await rootScreen(page)).toEqual(screen);
    expect({ screen: payload.screen, pointer: payload.pointer, density: payload.density }).toEqual(
      screen,
    );

    const measured = await widths(page);
    expect(measured.inner).toBe(viewport.width);
    expect(measured.document).toBe(viewport.width);
    expect(measured.body).toBeLessThanOrEqual(viewport.width);

    const controls = await visibleControls(page);
    expect(controls.length).toBeGreaterThan(0);
    if (expected.pointer === "coarse") expect(small(controls)).toEqual([]);

    const nav = await navigation(page);
    expect(nav.forms).toEqual([prerendered(listed) ? PRERENDER_NAV_FORM : expected.nav]);
    expect(nav.visible).toBe(true);
    expect(nav.left).toBeGreaterThanOrEqual(0);
    expect(nav.right).toBeLessThanOrEqual(viewport.width);
    const pageIds = new Set(committed.pages.map((entry) => entry.id));
    expect(nav.links.length).toBeGreaterThan(0);
    for (const link of nav.links) {
      expect(pageIds.has(link.address)).toBe(true);
      expect(link.visible).toBe(true);
      if (expected.pointer === "coarse") {
        expect(link.height).toBeGreaterThanOrEqual(MIN_AGENT_HIT_TARGET);
      }
    }
    expect(nav.links.filter((link) => link.current).map((link) => link.address)).toEqual([
      payload.page,
    ]);

    for (const overlay of listed.overlays) {
      const address = `${listed.id}/${overlay.id}`;
      await openOverlay(page, listed.id, overlay.id);
      const surface = page.locator(`[data-rex-overlay="${address}"]`);
      expect(await surface.getAttribute("data-rex-overlay-form")).toBe(expected.sheet);
      const box = await surface.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      const opened = await documentSidecar(page, listed.id);
      expect(opened.overlays.find((entry) => entry.id === overlay.id)?.open).toBe(true);
      await page.keyboard.press("Escape");
      await surface.waitFor({ state: "detached", timeout: STEP_TIMEOUT });
    }
  });
}

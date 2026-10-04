// @vitest-environment happy-dom
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  DESIGNX_DATA_TABLE,
  DESIGNX_MENU_GROUP,
  DESIGNX_UI_DIR,
  designxDependencies,
  designxFiles,
  providedDesignxNames,
  resolveDesignxItems,
} from "../cli/designx.ts";
import { DESIGNX_MAP } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const demoRoot = join(packageRoot, "..", "..", "examples", "demo");
const INSTALL_TIMEOUT_MS = 120_000;
const APP_PACKAGES = ["react", "react-dom"] as const;
const INSTALL_PREFIX = ".rex-designx-table-";

const temporary: string[] = [];

afterEach(() => {
  cleanup();
});

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function sourceOf(name: string): string {
  for (const base of [packageRoot, demoRoot]) {
    const candidate = join(base, "node_modules", name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} is installed neither for the rex package nor for the demo`);
}

function linkPackages(root: string, names: readonly string[]): void {
  for (const name of names) {
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(sourceOf(name)), destination, "dir");
  }
}

interface Holding {
  readonly name: string;
  readonly amount: string;
}

interface DataTableModule {
  readonly DataTable: ComponentType<{
    readonly columns: readonly { readonly accessorKey: keyof Holding; readonly header: string }[];
    readonly data: readonly Holding[];
  }>;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("the installed DesignX data-table", () => {
  it(
    "opens its column menu with the label grouped and hides a column",
    { timeout: INSTALL_TIMEOUT_MS },
    async () => {
      expect(DESIGNX_MAP.list.desktop).toBe(DESIGNX_DATA_TABLE);
      const names = [DESIGNX_DATA_TABLE];
      const items = await resolveDesignxItems(names);
      const files = designxFiles(items, providedDesignxNames(names, items));
      const root = mkdtempSync(join(packageRoot, INSTALL_PREFIX));
      temporary.push(root);
      for (const file of files) {
        const target = join(root, file.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
      }
      linkPackages(root, [...APP_PACKAGES, ...Object.keys(designxDependencies(items))]);

      const tableFile = join(root, DESIGNX_UI_DIR, `${DESIGNX_DATA_TABLE}.tsx`);
      expect(
        files.find((file) => file.path === `${DESIGNX_UI_DIR}/dropdown-menu.tsx`),
      ).toBeDefined();
      const { DataTable } = (await import(/* @vite-ignore */ tableFile)) as DataTableModule;
      const view = render(
        createElement(DataTable, {
          columns: [
            { accessorKey: "name", header: "Name" },
            { accessorKey: "amount", header: "Amount" },
          ],
          data: [
            { name: "PAX", amount: "12.5" },
            { name: "ETH", amount: "0.75" },
          ],
        }),
      );
      expect(within(view.container).getByText("Name")).toBeTruthy();

      await click(within(view.container).getByRole("button", { name: "View" }));
      const menu = await within(document.body).findByRole("menu");
      const label = within(menu).getByText("Toggle columns");
      expect(label.closest('[role="group"]')).not.toBeNull();
      expect(
        within(menu)
          .getAllByRole("menuitemcheckbox")
          .map((item) => item.textContent?.trim()),
      ).toEqual(["name", "amount"]);

      await click(within(menu).getByRole("menuitemcheckbox", { name: "name" }));
      await waitFor(() => expect(within(view.container).queryByText("Name")).toBeNull());
      expect(within(view.container).getByText("Amount")).toBeTruthy();
      expect(files.some((file) => file.content.includes(DESIGNX_MENU_GROUP))).toBe(true);
    },
  );
});

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { validateStandardSync } from "../core/standard.ts";
import { boolean, enumOf, integer, money, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import type { ActControlProps } from "./act.ts";
import {
  ACTION_FIELD,
  CSRF_FIELD,
  fieldErrors,
  formActionPath,
  formFields,
  formInput,
  type ActionFormViewProps,
} from "./form.tsx";
import { ActionFormView } from "./form-view.tsx";

const transfer = action("transfer", {
  input: z.object({
    amount: money(),
    memo: text({ max: 40 }).optional(),
    express: boolean(),
    count: integer({ min: 1, max: 9 }),
    tier: enumOf(["basic", "priority"]),
    source: enumOf(["card", "bank"]).optional(),
    tags: z.array(enumOf(["urgent", "gift"])),
    to: z.object({ name: text({ min: 1 }) }),
  }),
  output: z.object({ ok: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Transfer",
  handler: () => ({ ok: true }),
});

const manifest = buildManifest(createRegistry().register(transfer).freeze());
const listed = manifest.actions.find((entry) => entry.id === transfer.id);
if (listed === undefined) throw new Error("transfer is not in the manifest");
const schema = listed.input;
const fields = formFields(schema);
const PATHS = ["amount", "memo", "express", "count", "tier", "source", "tags", "to.name"];

const controlProps: ActControlProps = {
  "data-rex": "payments/transfer",
  "data-rex-allowed": "true",
  disabled: false,
  "aria-disabled": false,
  "aria-busy": false,
};

function props(overrides: Partial<ActionFormViewProps> = {}): ActionFormViewProps {
  return {
    actionId: transfer.id,
    path: formActionPath(transfer.id),
    label: "Transfer",
    address: "payments/transfer",
    hidden: [
      [CSRF_FIELD, "token-1"],
      [ACTION_FIELD, transfer.id],
    ],
    fields,
    errors: {},
    values: fields.map(() => undefined),
    unplaced: [],
    submitLabel: "Send transfer",
    controlProps,
    onSubmit: () => {},
    ...overrides,
  };
}

function form(): HTMLFormElement {
  return screen.getByRole("form", { name: "Transfer" }) as HTMLFormElement;
}

function control(owner: ParentNode, name: string): HTMLInputElement {
  const element = owner.querySelector(`input[name="${name}"]`);
  if (element === null) throw new Error(`no input named ${name}`);
  return element as HTMLInputElement;
}

function select(owner: ParentNode, name: string): HTMLSelectElement {
  const element = owner.querySelector(`select[name="${name}"]`);
  if (element === null) throw new Error(`no select named ${name}`);
  return element as HTMLSelectElement;
}

function options(element: HTMLSelectElement): string[] {
  return [...element.options].map((option) => option.value);
}

function selected(element: HTMLSelectElement): string[] {
  return [...element.options].filter((option) => option.selected).map((option) => option.value);
}

function rows(owner: ParentNode): string[] {
  return [...owner.querySelectorAll("[data-rex-field]")].map(
    (row) => row.getAttribute("data-rex-field") ?? "",
  );
}

afterEach(cleanup);

describe("ActionFormView", () => {
  it("renders a post form with hidden fields, a labelled control per field and the submit", () => {
    render(<ActionFormView {...props()} />);
    const view = form();
    expect(view.getAttribute("method")).toBe("post");
    expect(view.getAttribute("action")).toBe("/rex/form/transfer");
    expect(view.noValidate).toBe(true);
    expect(view.getAttribute("data-rex-form")).toBe("payments/transfer");
    expect(control(view, CSRF_FIELD)).toMatchObject({ type: "hidden", value: "token-1" });
    expect(control(view, ACTION_FIELD)).toMatchObject({ type: "hidden", value: "transfer" });
    expect(fields.map((field) => field.path)).toEqual(PATHS);
    expect(rows(view)).toEqual(PATHS);

    const amount = control(view, "amount");
    expect(screen.getByLabelText("Amount")).toBe(amount);
    expect(amount.type).toBe("text");
    expect(amount.getAttribute("inputmode")).toBe("decimal");
    expect(amount.required).toBe(true);
    const memo = control(view, "memo");
    expect(memo.required).toBe(false);
    expect(memo.maxLength).toBe(40);
    const express = control(view, "express");
    expect(express.type).toBe("checkbox");
    expect(express.value).toBe("true");
    expect(express.required).toBe(false);
    expect(screen.getByLabelText("Express")).toBe(express);
    const expressRow = express.closest("[data-rex-field]");
    expect(expressRow?.firstElementChild).toBe(express);
    expect(expressRow?.lastElementChild?.tagName).toBe("LABEL");
    const count = control(view, "count");
    expect(count.type).toBe("number");
    expect(count.getAttribute("step")).toBe("1");
    expect(count.getAttribute("min")).toBe("1");
    expect(count.getAttribute("max")).toBe("9");
    expect(count.closest("[data-rex-field]")?.firstElementChild?.tagName).toBe("LABEL");
    const tier = select(view, "tier");
    expect(tier.required).toBe(true);
    expect(options(tier)).toEqual(["basic", "priority"]);
    const source = select(view, "source");
    expect(source.required).toBe(false);
    expect(options(source)).toEqual(["", "card", "bank"]);
    expect(source.options[0]?.textContent).toBe("None");
    const tags = select(view, "tags");
    expect(tags.multiple).toBe(true);
    expect(options(tags)).toEqual(["urgent", "gift"]);
    const recipient = control(view, "to.name");
    expect(screen.getByLabelText("Name")).toBe(recipient);
    expect(recipient.required).toBe(true);
    expect(recipient.minLength).toBe(1);

    const button = within(view).getByRole("button", { name: "Send transfer" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("data-rex")).toBe("payments/transfer");
    expect(button.getAttribute("data-rex-allowed")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(view.querySelector("[data-rex-form-errors]")).toBeNull();
    expect(view.querySelectorAll("[aria-invalid]")).toHaveLength(0);
  });

  it("seeds each control from its default value by field order", () => {
    const defaults: Record<string, unknown> = {
      amount: "12.50",
      memo: "rent",
      express: true,
      count: BigInt(3),
      tier: "priority",
      source: "bank",
      tags: ["gift"],
      "to.name": { nested: true },
    };
    render(<ActionFormView {...props({ values: fields.map((field) => defaults[field.path]) })} />);
    const view = form();
    expect(control(view, "amount").value).toBe("12.50");
    expect(control(view, "memo").value).toBe("rent");
    expect(control(view, "express").checked).toBe(true);
    expect(control(view, "count").value).toBe("3");
    expect(select(view, "tier").value).toBe("priority");
    expect(select(view, "source").value).toBe("bank");
    expect(selected(select(view, "tags"))).toEqual(["gift"]);
    expect(control(view, "to.name").value).toBe("");
  });

  it("marks invalid controls, describes them by their error and lists the unplaced ones", () => {
    const checked = validateStandardSync(transfer.input, {
      amount: "12,5",
      express: false,
      count: 0,
      tier: "basic",
      tags: [],
      to: { name: "" },
    });
    if (checked.issues === undefined) throw new Error("the sample input must fail validation");
    const errors = fieldErrors(checked.issues);
    expect(Object.keys(errors).sort()).toEqual(["amount", "count", "to.name"]);
    render(
      <ActionFormView
        {...props({
          errors,
          unplaced: [
            ["_form", "check the form"],
            ["extra", "extra: is unknown"],
          ],
        })}
      />,
    );
    const view = form();
    for (const path of ["amount", "count", "to.name"]) {
      const input = control(view, path);
      const message = view.querySelector(
        `[data-rex-field="${path}"] [data-rex-field-error="${path}"]`,
      );
      expect(message?.textContent).toBe(errors[path]?.join("; "));
      expect(message?.textContent).not.toBe("");
      expect(message?.id).not.toBe("");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(message?.id);
    }
    expect(control(view, "memo").getAttribute("aria-invalid")).toBeNull();
    expect(control(view, "memo").getAttribute("aria-describedby")).toBeNull();
    expect(view.querySelectorAll("[data-rex-field] [data-rex-field-error]")).toHaveLength(3);
    const list = view.querySelector('[data-rex-form-errors="transfer"]');
    expect(
      [...(list?.querySelectorAll("li") ?? [])].map((item) => [
        item.getAttribute("data-rex-field-error"),
        item.textContent,
      ]),
    ).toEqual([
      ["_form", "check the form"],
      ["extra", "extra: is unknown"],
    ]);
  });

  it("hands the submit event to the handler with form data formInput coerces to the schema", async () => {
    const submitted: unknown[] = [];
    render(
      <ActionFormView
        {...props({
          onSubmit: (event) => {
            event.preventDefault();
            submitted.push(formInput(schema, new FormData(event.currentTarget)));
          },
        })}
      />,
    );
    const view = form();
    fireEvent.change(control(view, "amount"), { target: { value: "12.50" } });
    fireEvent.change(control(view, "memo"), { target: { value: "rent" } });
    fireEvent.click(control(view, "express"));
    fireEvent.change(control(view, "count"), { target: { value: "3" } });
    fireEvent.change(select(view, "tier"), { target: { value: "priority" } });
    const tags = select(view, "tags");
    for (const option of tags.options) option.selected = option.value === "gift";
    fireEvent.change(tags);
    fireEvent.change(control(view, "to.name"), { target: { value: "Ada" } });
    await act(async () => {
      fireEvent.click(within(view).getByRole("button", { name: "Send transfer" }));
    });
    expect(submitted).toEqual([
      {
        amount: "12.50",
        memo: "rent",
        express: true,
        count: 3,
        tier: "priority",
        tags: ["gift"],
        to: { name: "Ada" },
      },
    ]);
    expect(validateStandardSync(transfer.input, submitted[0]).issues).toBeUndefined();
  });

  it("renders the given children instead of generated rows when fields is null", () => {
    render(
      <ActionFormView {...props({ fields: null, unplaced: [["memo", "memo: too long"]] })}>
        <label>
          Memo
          <input name="memo" />
        </label>
      </ActionFormView>,
    );
    const view = form();
    expect(rows(view)).toEqual([]);
    expect(screen.getByLabelText("Memo")).toBe(control(view, "memo"));
    expect(control(view, CSRF_FIELD).value).toBe("token-1");
    expect(control(view, ACTION_FIELD).value).toBe("transfer");
    expect(view.querySelector('[data-rex-form-errors="transfer"]')?.textContent).toBe(
      "memo: too long",
    );
    expect(within(view).getByRole("button", { name: "Send transfer" }).tagName).toBe("BUTTON");
  });
});

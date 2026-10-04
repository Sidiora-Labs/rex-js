import { useId, type ReactNode } from "react";
import { RexError } from "../core/errors.ts";
import { List } from "./list.tsx";

export const SPACES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const COLUMNS = [1, 2, 3, 4] as const;

export type Space = (typeof SPACES)[number];
export type Columns = (typeof COLUMNS)[number];

export const DEFAULT_SPACE: Space = 3;

function checkSpace(component: string, space: unknown): Space {
  if (!(SPACES as readonly unknown[]).includes(space)) {
    throw new RexError(
      "REX314",
      `Page.${component}: space must be a token step 1..8, received ${String(space)}`,
    );
  }
  return space as Space;
}

function checkColumns(columns: unknown): Columns {
  if (!(COLUMNS as readonly unknown[]).includes(columns)) {
    throw new RexError("REX314", `Page.Grid: columns must be 1..4, received ${String(columns)}`);
  }
  return columns as Columns;
}

export function spaceClass(space: Space): string {
  return `rex-space-${space}`;
}

export function columnsClass(columns: Columns): string {
  return `rex-cols-${columns}`;
}

export interface StackProps {
  readonly space?: Space;
  readonly children?: ReactNode;
}

export interface GridProps {
  readonly space?: Space;
  readonly columns?: Columns;
  readonly children?: ReactNode;
}

export interface SectionProps {
  readonly title: string;
  readonly space?: Space;
  readonly children?: ReactNode;
}

export interface OutcomeProps {
  readonly space?: Space;
  readonly children?: ReactNode;
}

function Stack({ space = DEFAULT_SPACE, children }: StackProps) {
  return <div className={`rex-stack ${spaceClass(checkSpace("Stack", space))}`}>{children}</div>;
}

function Grid({ space = DEFAULT_SPACE, columns = 2, children }: GridProps) {
  const tokens = `${columnsClass(checkColumns(columns))} ${spaceClass(checkSpace("Grid", space))}`;
  return <div className={`rex-grid ${tokens}`}>{children}</div>;
}

function Section({ title, space = DEFAULT_SPACE, children }: SectionProps) {
  const headingId = useId();
  if (typeof title !== "string" || title.trim() === "") {
    throw new RexError("REX314", "Page.Section: title must be a non-empty string");
  }
  return (
    <section
      aria-labelledby={headingId}
      className={`rex-section ${spaceClass(checkSpace("Section", space))}`}
    >
      <h2 id={headingId} className="rex-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Outcome({ space = DEFAULT_SPACE, children }: OutcomeProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Outcome"
      className={`rex-outcome ${spaceClass(checkSpace("Outcome", space))}`}
    >
      {children}
    </section>
  );
}

export const Page = Object.freeze({ Stack, Grid, Section, Outcome, List });

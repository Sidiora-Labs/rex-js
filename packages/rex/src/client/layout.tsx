import { useId, type ReactNode } from "react";
import { RexError } from "../core/errors.ts";
import { List } from "./list.tsx";
import {
  DEFAULT_SPACE,
  PageOutcome,
  checkSpace,
  spaceClass,
  type Space,
} from "./outcome-frame.tsx";

export {
  DEFAULT_SPACE,
  SPACES,
  spaceClass,
  type OutcomeProps,
  type Space,
} from "./outcome-frame.tsx";

export const COLUMNS = [1, 2, 3, 4] as const;

export type Columns = (typeof COLUMNS)[number];

function checkColumns(columns: unknown): Columns {
  if (!(COLUMNS as readonly unknown[]).includes(columns)) {
    throw new RexError("REX314", `Page.Grid: columns must be 1..4, received ${String(columns)}`);
  }
  return columns as Columns;
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

export const Page = Object.freeze({ Stack, Grid, Section, Outcome: PageOutcome, List });

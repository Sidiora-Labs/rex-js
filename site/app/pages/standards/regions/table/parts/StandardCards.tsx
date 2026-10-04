import type { ActionOutput } from "@sidioralabs/rex";
import type { readStandards } from "../../../../../actions/standards/read-standards.ts";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card.tsx";
import StatusBadge from "./StatusBadge.tsx";
import TaskList from "./TaskList.tsx";

export interface StandardCardsProps {
  readonly items: ActionOutput<typeof readStandards>["items"];
}

export default function StandardCards({ items }: StandardCardsProps) {
  return (
    <ul
      data-site-standards-form="cards"
      aria-label="Standards"
      className="m-0 flex list-none flex-col gap-3 p-0 md:hidden"
    >
      {items.map((item) => (
        <li key={item.id} data-site-standard-card={item.id}>
          <Card className="gap-3 py-4">
            <CardHeader className="flex items-center justify-between gap-2 px-4">
              <CardTitle>
                <code className="text-sm">{item.id}</code>
              </CardTitle>
              <StatusBadge status={item.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
              <p className="m-0 text-sm">{item.requirement}</p>
              <TaskList tasks={item.tasks} recorded={item.recorded} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

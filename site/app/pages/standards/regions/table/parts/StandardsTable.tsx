import type { ActionOutput } from "@sidioralabs/rex";
import type { readStandards } from "../../../../../actions/read-standards.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table.tsx";
import StatusBadge from "./StatusBadge.tsx";
import TaskList from "./TaskList.tsx";

export interface StandardsTableProps {
  readonly items: ActionOutput<typeof readStandards>["items"];
}

export default function StandardsTable({ items }: StandardsTableProps) {
  return (
    <div data-site-standards-form="table" className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Standard</TableHead>
            <TableHead scope="col">Requirement</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Tasks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-site-standard={item.id}>
              <TableCell className="align-top">
                <code className="text-xs">{item.id}</code>
              </TableCell>
              <TableCell className="align-top whitespace-normal">{item.requirement}</TableCell>
              <TableCell className="align-top">
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="align-top whitespace-normal">
                <TaskList tasks={item.tasks} recorded={item.recorded} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

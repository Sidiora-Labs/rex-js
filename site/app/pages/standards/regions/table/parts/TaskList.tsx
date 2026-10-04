import { Badge } from "../../../../../components/ui/badge.tsx";

export interface TaskListProps {
  readonly tasks: readonly { readonly id: string; readonly status: string }[];
  readonly recorded: string;
}

export default function TaskList({ tasks, recorded }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p data-site-task-none="" className="m-0 text-sm text-muted-foreground">
        No owning task, recorded as {recorded}
      </p>
    );
  }
  return (
    <ul aria-label="Owning tasks" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {tasks.map((task) => (
        <li key={task.id} data-site-task={task.id}>
          <Badge variant={task.status === "done" ? "tonal" : "outline"}>
            {task.id} {task.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

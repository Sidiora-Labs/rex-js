import type { ActControlProps } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";

export default function Welcome(props: {
  readonly notes: readonly { readonly id: string; readonly name: string }[];
  readonly actionLabel: string;
  readonly control: ActControlProps;
  readonly onAction: () => void;
}) {
  return (
    <div>
      <ul>
        {props.notes.map((note) => (
          <li key={note.id}>{note.name}</li>
        ))}
      </ul>
      <Button {...props.control} onClick={props.onAction}>
        {props.actionLabel}
      </Button>
    </div>
  );
}

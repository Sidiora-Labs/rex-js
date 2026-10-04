import type { FormEvent } from "react";
import type { ActControlProps } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";
import Field from "../../../../../components/Field.tsx";

export interface ContactChoice {
  readonly id: string;
  readonly name: string;
  readonly address: string;
}

export interface ContactOptionsProps {
  readonly contacts: readonly ContactChoice[];
  readonly selected: string;
  readonly query: string;
  readonly control: ActControlProps;
  readonly onQuery: (query: string) => void;
  readonly onPick: (contact: string) => void;
}

export default function ContactOptions({
  contacts,
  selected,
  query,
  control,
  onQuery,
  onPick,
}: ContactOptionsProps) {
  const needle = query.trim().toLowerCase();
  const matches = contacts.filter(
    (entry) =>
      needle === "" ||
      entry.name.toLowerCase().includes(needle) ||
      entry.address.toLowerCase().includes(needle),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const first = matches[0];
    if (first !== undefined) onPick(first.id);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label="Type a name or address, then press Enter"
        name="contact-query"
        autoComplete="off"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      {matches.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No contact matches "{query}"</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {matches.map((entry) => (
            <li key={entry.id}>
              <Button
                tone={entry.id === selected ? "primary" : "quiet"}
                className="h-auto min-h-11 w-full justify-start py-2 text-left whitespace-normal"
                {...control}
                data-rex-choice={entry.id}
                aria-pressed={entry.id === selected}
                onClick={() => onPick(entry.id)}
              >
                {`${entry.name} ${entry.address}`}
                {entry.id === selected ? " (selected)" : null}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

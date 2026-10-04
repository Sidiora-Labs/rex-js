import type { FormEvent } from "react";
import type { ActControlProps } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";
import Field from "../../../../../components/Field.tsx";
import TokenAvatar from "../../../../../components/TokenAvatar.tsx";

export interface TokenChoice {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly balance: string;
}

export interface TokenOptionsProps {
  readonly tokens: readonly TokenChoice[];
  readonly selected: string;
  readonly query: string;
  readonly control: ActControlProps;
  readonly onQuery: (query: string) => void;
  readonly onPick: (token: string) => void;
}

export default function TokenOptions({
  tokens,
  selected,
  query,
  control,
  onQuery,
  onPick,
}: TokenOptionsProps) {
  const needle = query.trim().toLowerCase();
  const matches = tokens.filter(
    (entry) =>
      needle === "" ||
      entry.symbol.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const first = matches[0];
    if (first !== undefined) onPick(first.id);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label="Type a token symbol or name, then press Enter"
        name="token-query"
        autoComplete="off"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      {matches.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No token matches "{query}"</p>
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
                <TokenAvatar symbol={entry.symbol} size="sm" />
                {`${entry.symbol} ${entry.name}, balance ${entry.balance}`}
                {entry.id === selected ? " (selected)" : null}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

import type { FormEvent } from "react";
import Button from "../../../../../components/Button.tsx";
import Field from "../../../../../components/Field.tsx";

export interface FilterFormProps {
  readonly query: string;
  readonly onQuery: (query: string) => void;
}

export default function FilterForm({
  query,
  onQuery,
  onDone,
}: FilterFormProps & { readonly onDone: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label="Symbol or name contains"
        name="holdings-filter"
        value={query}
        placeholder="ETH"
        autoComplete="off"
        onChange={(event) => onQuery(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" tone="primary">
          Apply filter
        </Button>
        <Button onClick={() => onQuery("")}>Clear filter</Button>
      </div>
    </form>
  );
}

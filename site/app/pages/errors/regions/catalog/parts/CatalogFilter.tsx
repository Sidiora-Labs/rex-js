import { Field, FieldDescription, FieldLabel } from "../../../../../components/ui/field.tsx";
import { Input } from "../../../../../components/ui/input.tsx";

export interface CatalogFilterProps {
  readonly query: string;
  readonly shown: number;
  readonly total: number;
  readonly onQuery: (query: string) => void;
}

export default function CatalogFilter({ query, shown, total, onQuery }: CatalogFilterProps) {
  return (
    <Field data-site-errors-filter="" className="max-w-xl">
      <FieldLabel>Filter by code or message</FieldLabel>
      <Input
        type="search"
        name="errors-filter"
        value={query}
        placeholder="REX330 or hydration"
        autoComplete="off"
        className="pointer-coarse:min-h-11"
        onValueChange={(value) => onQuery(value)}
      />
      <FieldDescription aria-live="polite">
        {shown === total ? `${total} codes` : `${shown} of ${total} codes`}
      </FieldDescription>
    </Field>
  );
}

import { Typography } from "../../../../../components/ui/typography.tsx";

export interface NoMatchProps {
  readonly query: string;
}

export default function NoMatch({ query }: NoMatchProps) {
  return (
    <Typography variant="muted" role="status" data-site-errors-empty="">
      No error code or message contains “{query}”.
    </Typography>
  );
}

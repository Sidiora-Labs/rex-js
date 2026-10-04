import { Typography } from "../../../../../components/ui/typography.tsx";

export interface CatalogIntroProps {
  readonly count: number;
  readonly areas: number;
}

export default function CatalogIntro({ count, areas }: CatalogIntroProps) {
  return (
    <Typography variant="lead" data-site-errors-count={count}>
      Every error Rex raises is a RexError with one of these {count} codes in {areas} areas. The
      message, the hint and the docs link printed with each one lead here.
    </Typography>
  );
}

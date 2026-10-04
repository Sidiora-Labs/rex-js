import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "../../../../../components/ui/pagination.tsx";

export interface CodeLink {
  readonly code: string;
  readonly href: string;
}

export interface CodeNeighboursProps {
  readonly previous: CodeLink | null;
  readonly next: CodeLink | null;
}

export default function CodeNeighbours({ previous, next }: CodeNeighboursProps) {
  return (
    <Pagination aria-label="Neighbouring error codes" className="justify-between">
      <PaginationContent className="flex w-full justify-between">
        <PaginationItem>
          {previous === null ? null : (
            <PaginationLink
              href={previous.href}
              size="default"
              rel="prev"
              aria-label={`Previous code ${previous.code}`}
              data-site-error-previous={previous.code}
              className="gap-1 font-mono pointer-coarse:min-h-11"
            >
              <span aria-hidden="true">←</span>
              <span>{previous.code}</span>
            </PaginationLink>
          )}
        </PaginationItem>
        <PaginationItem>
          {next === null ? null : (
            <PaginationLink
              href={next.href}
              size="default"
              rel="next"
              aria-label={`Next code ${next.code}`}
              data-site-error-next={next.code}
              className="gap-1 font-mono pointer-coarse:min-h-11"
            >
              <span>{next.code}</span>
              <span aria-hidden="true">→</span>
            </PaginationLink>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

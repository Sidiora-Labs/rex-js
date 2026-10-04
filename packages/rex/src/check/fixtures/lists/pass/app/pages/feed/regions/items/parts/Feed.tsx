import { Page } from "@sidioralabs/rex/client";
import { useEffect, useRef } from "react";

export interface FeedProps {
  readonly entries: readonly string[];
}

const filters = ["all", "unread"];

export default function Feed({ entries }: FeedProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(() => undefined);
    if (end.current !== null) observer.observe(end.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div>
      <ul aria-label="Filters">
        {filters.map((filter) => (
          <li key={filter}>{filter}</li>
        ))}
      </ul>
      <Page.List name="entries" items={entries} itemKey={(entry) => entry} size={2}>
        {(entry) => entry}
      </Page.List>
      <div ref={end} />
    </div>
  );
}

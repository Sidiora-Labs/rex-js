import { useEffect } from "react";

export interface ActivityProps {
  readonly entries: readonly string[];
}

export default function Activity({ entries }: ActivityProps) {
  useEffect(() => {
    const more = () => undefined;
    window.addEventListener("scroll", more);
    return () => window.removeEventListener("scroll", more);
  }, []);
  return (
    <div role="feed">
      {entries.map((entry) => (
        <article key={entry}>{entry}</article>
      ))}
    </div>
  );
}

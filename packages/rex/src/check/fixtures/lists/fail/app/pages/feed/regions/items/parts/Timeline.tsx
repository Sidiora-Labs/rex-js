import { useEffect, useRef } from "react";

export interface TimelineProps {
  readonly entries: readonly string[];
}

export default function Timeline({ entries }: TimelineProps) {
  const sentinel = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(() => undefined);
    if (sentinel.current !== null) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);
  return (
    <ol>
      {entries.map((entry) => (
        <li key={entry}>{entry}</li>
      ))}
      <li ref={sentinel}>More</li>
    </ol>
  );
}

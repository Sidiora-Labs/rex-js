export interface FeedProps {
  readonly entries: readonly string[];
}

export default function Feed({ entries }: FeedProps) {
  const more = () => undefined;
  return (
    <ul onScroll={more}>
      {entries.map((entry) => (
        <li key={entry}>{entry}</li>
      ))}
    </ul>
  );
}

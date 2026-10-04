export interface RowsProps {
  readonly entries: readonly string[];
}

export default function Rows({ entries }: RowsProps) {
  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry}>{entry}</li>
      ))}
    </ul>
  );
}

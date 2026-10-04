export interface HoldingRowProps {
  readonly symbol: string;
}

export default function HoldingRow({ symbol }: HoldingRowProps) {
  const preview = () => undefined;
  return (
    <li
      className="row hover:bg-surface-raised"
      onMouseEnter={preview}
      onFocus={preview}
      draggable
      data-rex-alternative="home/move-holding"
    >
      {symbol}
    </li>
  );
}

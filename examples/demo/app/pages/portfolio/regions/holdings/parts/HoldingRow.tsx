export interface Holding {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly balance: string;
  readonly valueUsd: string;
  readonly dust: boolean;
}

export default function HoldingRow({ holding }: { readonly holding: Holding }) {
  return (
    <span data-demo-holding={holding.id}>
      <strong>{holding.symbol}</strong> {holding.name}: {holding.balance} ({`$${holding.valueUsd}`})
      {holding.dust ? " dust" : null}
    </span>
  );
}

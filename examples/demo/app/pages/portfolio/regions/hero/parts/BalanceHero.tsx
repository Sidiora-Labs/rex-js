import Card from "../../../../../components/Card.tsx";

export interface BalanceHeroProps {
  readonly name: string;
  readonly address: string;
  readonly totalUsd: string;
  readonly tokenCount: number;
}

export default function BalanceHero({ name, address, totalUsd, tokenCount }: BalanceHeroProps) {
  return (
    <Card title={name}>
      <p>
        Total balance <strong data-demo-total="">{`$${totalUsd}`}</strong>
      </p>
      <p>
        {tokenCount} {tokenCount === 1 ? "token" : "tokens"} held
      </p>
      <p>
        Address <code>{address}</code>
      </p>
    </Card>
  );
}

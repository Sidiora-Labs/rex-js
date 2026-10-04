import BalanceCard, { type BalanceCardProps } from "../../../../../components/BalanceCard.tsx";

export type BalanceHeroProps = BalanceCardProps;

export default function BalanceHero(props: BalanceHeroProps) {
  return <BalanceCard {...props} />;
}

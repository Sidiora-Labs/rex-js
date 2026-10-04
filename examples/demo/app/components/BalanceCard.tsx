import { WalletIcon } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber.tsx";
import ChangeBadge from "./ChangeBadge.tsx";
import { Meter, MeterLabel, MeterValue } from "./ui/meter.tsx";

export interface BalanceCardProps {
  readonly name: string;
  readonly address: string;
  readonly totalUsd: string;
  readonly tokenCount: number;
  readonly change24hUsd: string;
  readonly change24hPct: string;
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function usd(value: number): string {
  return USD.format(value);
}

export default function BalanceCard({
  name,
  address,
  totalUsd,
  tokenCount,
  change24hUsd,
  change24hPct,
}: BalanceCardProps) {
  const change = Number(change24hUsd);
  const pct = Number(change24hPct);
  const meter = Math.min(100, Math.abs(pct) * 10);
  return (
    <section
      aria-label={`${name} balance`}
      className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-(--dx-blue-5) via-(--dx-blue-4) to-(--dx-purple-4) p-6 text-white shadow-float sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <span className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/15 [&_svg]:size-5">
            <WalletIcon aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold">{name}</span>
            <span className="text-sm text-white/85">
              {tokenCount} {tokenCount === 1 ? "token" : "tokens"} held
            </span>
          </span>
        </span>
        <ChangeBadge pct={change24hPct} />
      </div>
      <p className="mt-8 mb-1 text-sm font-medium tracking-[0.08em] text-white/85 uppercase">
        Total balance
      </p>
      <p className="m-0 text-[clamp(2.25rem,5vw,3.5rem)] leading-none font-normal tracking-[-0.03em]">
        <strong data-demo-total="" className="font-normal">
          <AnimatedNumber value={Number(totalUsd)} format={usd} />
        </strong>
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-end">
        <p className="m-0 flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-white/85">Address</span>
          <code
            id="wallet-address"
            className="truncate rounded-md bg-white/10 px-2 py-1 font-mono text-[13px] text-white"
          >
            {address}
          </code>
        </p>
        <Meter
          value={meter}
          min={0}
          max={100}
          aria-valuetext={`${change >= 0 ? "+" : "-"}${usd(Math.abs(change))} in 24 hours`}
          className="text-white"
          indicatorClassName={pct < 0 ? "bg-(--dx-red-2)" : "bg-(--dx-green-2)"}
        >
          <MeterLabel className="text-white/85">24h change</MeterLabel>
          <MeterValue className="text-white">
            {() => `${change >= 0 ? "+" : "-"}${usd(Math.abs(change))}`}
          </MeterValue>
        </Meter>
      </div>
    </section>
  );
}

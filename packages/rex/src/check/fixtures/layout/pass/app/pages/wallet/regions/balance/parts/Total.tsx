import { Button } from "../../../../../components/ui/button.tsx";

export default function Total() {
  return (
    <div className="w-full min-h-0 max-w-[480px]">
      <p style={{ minWidth: "12ch", height: "auto" }}>Total</p>
      <Button className="h-8 min-h-(--rex-hit-target)">Send</Button>
      <Button className="pointer-fine:h-7">Receive</Button>
      <a href="/wallet/history" style={{ minHeight: "var(--rex-hit-target)", height: "2rem" }}>
        History
      </a>
      <img src="/wallet.png" alt="Wallet" width={48} height={48} />
    </div>
  );
}

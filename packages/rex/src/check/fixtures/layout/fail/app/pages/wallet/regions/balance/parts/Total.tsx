import { Button } from "../../../../../components/ui/button.tsx";

export default function Total() {
  return (
    <div className="w-[320px] min-h-[120px]">
      <p style={{ minWidth: "200px", height: 48 }}>Total</p>
      <Button className="md:h-9 pointer-coarse:h-12">Send</Button>
      <a href="/wallet/history" style={{ minHeight: "2rem" }}>
        History
      </a>
    </div>
  );
}

import { Avatar, AvatarFallback } from "./ui/avatar.tsx";
import { cn } from "./ui/utils.ts";

const TOKEN_TONES: Readonly<Record<string, string>> = {
  ETH: "bg-(--dx-purple-1) text-(--dx-purple-5)",
  USDC: "bg-(--dx-blue-1) text-(--dx-blue-5)",
  PAX: "bg-(--dx-green-1) text-(--dx-green-5)",
  DUST: "bg-(--dx-grey-1) text-(--dx-grey-5)",
};

export interface TokenAvatarProps {
  readonly symbol: string;
  readonly size?: "sm" | "default";
}

export default function TokenAvatar({ symbol, size = "default" }: TokenAvatarProps) {
  return (
    <Avatar aria-hidden="true" className={size === "sm" ? "size-7" : "size-9"}>
      <AvatarFallback
        className={cn(
          "font-semibold",
          size === "sm" ? "text-[10px]" : "text-[11px]",
          TOKEN_TONES[symbol] ?? "bg-container-high text-foreground",
        )}
      >
        {symbol.slice(0, 4)}
      </AvatarFallback>
    </Avatar>
  );
}

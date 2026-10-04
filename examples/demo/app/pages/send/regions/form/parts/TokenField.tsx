import type { ActControlProps, OverlayHandle } from "@sidioralabs/rex/client";
import { ChevronsUpDownIcon, RefreshCwIcon } from "../../../../../components/icons.ts";
import Button from "../../../../../components/Button.tsx";
import TokenAvatar from "../../../../../components/TokenAvatar.tsx";

export interface TokenFieldProps {
  readonly token: {
    readonly symbol: string;
    readonly name: string;
    readonly balance: string;
  } | null;
  readonly control: ActControlProps;
  readonly sheetTrigger: OverlayHandle["triggerProps"];
  readonly onNext: () => void;
}

export default function TokenField({ token, control, sheetTrigger, onNext }: TokenFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Token</span>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-container p-3">
        {token === null ? null : <TokenAvatar symbol={token.symbol} />}
        <p
          className="m-0 flex min-w-0 flex-1 flex-col"
          data-demo-selected-token={token === null ? "" : token.symbol}
        >
          {token === null ? (
            <span className="text-muted-foreground">No token selected</span>
          ) : (
            <>
              <span className="font-medium">{`${token.symbol} (${token.name})`}</span>
              <span className="text-sm text-muted-foreground">{`Balance ${token.balance}`}</span>
            </>
          )}
        </p>
        <span className="flex flex-wrap gap-2">
          <Button {...sheetTrigger}>
            <ChevronsUpDownIcon aria-hidden="true" />
            Choose token
          </Button>
          <Button tone="ghost" {...control} onClick={onNext}>
            <RefreshCwIcon aria-hidden="true" />
            Next token
          </Button>
        </span>
      </div>
    </div>
  );
}

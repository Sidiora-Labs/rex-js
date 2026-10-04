import { store } from "@sidioralabs/rex/client";

export const DEFAULT_WATCHLIST: readonly string[] = ["eth", "pax"];

export const watchlist = store<readonly string[]>("watchlist", {
  initial: DEFAULT_WATCHLIST,
  expose: true,
});

export function toggleWatched(tokenId: string): void {
  watchlist.update((current) =>
    current.includes(tokenId)
      ? current.filter((entry) => entry !== tokenId)
      : [...current, tokenId].sort(),
  );
}

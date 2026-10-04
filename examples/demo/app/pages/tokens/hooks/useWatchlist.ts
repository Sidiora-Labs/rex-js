import { toggleWatched, watchlist } from "../../../data/watchlist.ts";

export function useWatchlist() {
  return { watched: watchlist.useStore(), toggle: toggleWatched };
}

import { useScreen } from "@sidioralabs/rex/client";

export { useScreen };

export function useIsMobile(): boolean {
  return useScreen().screen === "phone";
}

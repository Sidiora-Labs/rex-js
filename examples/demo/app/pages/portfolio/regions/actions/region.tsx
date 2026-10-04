import { region, useOverlay, useRegistry } from "@sidioralabs/rex/client";
import { useHoldingsFilter } from "../../hooks/useHoldingsFilter.ts";
import HoldingsFilterSheet, { HoldingsFilterContent } from "../../overlays/HoldingsFilterSheet.tsx";
import QuickActions from "./parts/QuickActions.tsx";

export default region("actions", ({ nav }) => {
  const registry = useRegistry();
  const filter = useHoldingsFilter();
  const sheet = useOverlay(HoldingsFilterSheet);
  const sendPage = registry.find("page", "send");
  return (
    <HoldingsFilterContent value={{ query: filter.query, onQuery: filter.setQuery }}>
      <QuickActions
        filter={filter.query}
        sheetTrigger={sheet.triggerProps}
        sendPage={sendPage === undefined ? null : sendPage.id}
        onSend={() => {
          if (sendPage !== undefined) nav.to(sendPage);
        }}
      />
      <HoldingsFilterSheet />
    </HoldingsFilterContent>
  );
});

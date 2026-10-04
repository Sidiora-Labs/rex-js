import { actionLabel, region } from "@sidioralabs/rex/client";
import { ping } from "../../../../actions/ping.ts";
import { useNotes } from "../../hooks/useNotes.ts";
import Welcome from "./parts/Welcome.tsx";

export default region("welcome", ({ act }) => {
  const notes = useNotes();
  const handle = act(ping);
  return (
    <Welcome
      notes={notes.data ?? []}
      actionLabel={actionLabel(handle.action)}
      control={handle.controlProps}
      onAction={() => {
        void handle.run({});
      }}
    />
  );
});

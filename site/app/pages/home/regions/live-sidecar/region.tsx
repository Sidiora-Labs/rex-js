import { region } from "@sidioralabs/rex/client";
import { useLiveSidecar } from "../../hooks/useLiveSidecar.ts";
import LiveSidecar from "./parts/LiveSidecar.tsx";

export default region("live-sidecar", () => {
  const sidecar = useLiveSidecar();
  return (
    <LiveSidecar
      json={sidecar.json}
      copyAddress={sidecar.copyAddress}
      onCopy={() => {
        void sidecar.copy();
      }}
    />
  );
});

import { useEffect, useState, type CSSProperties } from "react";
import { useRouteChanges } from "../router.tsx";
import { NOT_FOUND_TITLE } from "./header.tsx";
import type { ShellSlotProps } from "./slots.ts";

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

export function AnnouncerSlot({ active }: ShellSlotProps) {
  const changes = useRouteChanges();
  const title = active === null ? NOT_FOUND_TITLE : active.chrome.title;
  const [message, setMessage] = useState("");
  useEffect(() => {
    setMessage(changes === 0 ? "" : title);
  }, [changes, title]);
  return (
    <div aria-live="polite" aria-atomic="true" data-rex-announcer="" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  );
}

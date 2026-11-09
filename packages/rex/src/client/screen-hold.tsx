import { useContext, useState, type ReactNode } from "react";
import { ScreenContext } from "./screen.ts";

export interface ScreenHoldProps {
  readonly held: boolean;
  readonly children?: ReactNode;
}

export function ScreenHold({ held, children }: ScreenHoldProps) {
  const live = useContext(ScreenContext);
  const [first] = useState(live);
  return <ScreenContext.Provider value={held ? first : live}>{children}</ScreenContext.Provider>;
}

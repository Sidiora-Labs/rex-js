import { ConnectedDevtools } from "../devtools/devtools.tsx";
import type { ShellSlotProps } from "./slots.ts";

export { DevtoolsProvider } from "../devtools/provider.tsx";

export function DevtoolsSlot(_props: ShellSlotProps) {
  return <ConnectedDevtools />;
}

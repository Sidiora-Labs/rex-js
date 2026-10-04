import type { ComponentProps } from "react";

export function Dialog(props: ComponentProps<"dialog">) {
  return <dialog {...props} />;
}

export function DialogContent(props: ComponentProps<"div">) {
  return <div {...props} />;
}

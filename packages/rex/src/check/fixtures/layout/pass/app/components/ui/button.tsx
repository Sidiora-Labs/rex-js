import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`h-9 w-[120px] ${className}`} {...props} />;
}

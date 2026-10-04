import type { ButtonHTMLAttributes } from "react";
import { Button as DesignxButton } from "./ui/button.tsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: "primary" | "quiet";
}

export default function Button({ tone = "quiet", type = "button", ...props }: ButtonProps) {
  return (
    <DesignxButton
      type={type}
      {...props}
      data-tone={tone}
      variant={tone === "primary" ? "default" : "outline"}
    />
  );
}

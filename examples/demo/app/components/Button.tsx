import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Button as DesignxButton } from "./ui/button.tsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: "primary" | "quiet" | "ghost";
  readonly size?: ComponentProps<typeof DesignxButton>["size"];
  readonly render?: ComponentProps<typeof DesignxButton>["render"];
}

const VARIANTS = { primary: "default", quiet: "outline", ghost: "ghost" } as const;

export default function Button({ tone = "quiet", type = "button", render, ...props }: ButtonProps) {
  return (
    <DesignxButton
      type={render === undefined ? type : undefined}
      render={render}
      {...props}
      data-tone={tone}
      variant={VARIANTS[tone]}
    />
  );
}

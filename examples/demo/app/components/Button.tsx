import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: "primary" | "quiet";
}

export default function Button({ tone = "quiet", style, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      data-tone={tone}
      style={{
        minBlockSize: "var(--rex-hit-target)",
        paddingBlock: "var(--rex-space-2)",
        paddingInline: "var(--rex-space-4)",
        borderRadius: "var(--rex-radius-2)",
        border: tone === "primary" ? "2px solid currentcolor" : "1px solid currentcolor",
        background: "transparent",
        color: "inherit",
        fontWeight: tone === "primary" ? 600 : 400,
        transitionDuration: "var(--rex-motion-duration)",
        cursor: props.disabled === true ? "not-allowed" : "pointer",
        ...style,
      }}
    />
  );
}

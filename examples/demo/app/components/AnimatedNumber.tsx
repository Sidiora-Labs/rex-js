import { useEffect, useRef, useState } from "react";

export interface AnimatedNumberProps {
  readonly value: number;
  readonly format: (value: number) => string;
  readonly durationMs?: number;
}

function prefersStill(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.getAttribute("data-rex-density") === "agent") return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AnimatedNumber({ value, format, durationMs = 700 }: AnimatedNumberProps) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || prefersStill()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setShown(start + (value - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

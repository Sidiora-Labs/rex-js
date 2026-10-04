import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";

export type NativeTag = "div" | "span" | "section" | "article" | "figure";

export type NativeMount = (node: HTMLElement) => void | (() => void);

export interface NativeProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML"> {
  readonly as?: NativeTag;
  readonly mount?: NativeMount;
}

export const Native = forwardRef<HTMLElement, NativeProps>(function Native(
  { as = "div", mount, ...rest },
  forwarded,
) {
  const node = useRef<HTMLElement | null>(null);
  useImperativeHandle(forwarded, () => node.current as HTMLElement, [as]);
  useEffect(() => {
    const current = node.current;
    if (current === null || mount === undefined) return;
    const cleanup = mount(current);
    return typeof cleanup === "function" ? cleanup : undefined;
  }, [mount, as]);
  return createElement(as, { ...rest, ref: node });
});
Native.displayName = "Native";

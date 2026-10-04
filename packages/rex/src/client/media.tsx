import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { RexError } from "../core/errors.ts";
import { REX_DATA_ELEMENT_ID } from "./hydrate.ts";
import { registerReset } from "./reset.ts";

export const SCRIPT_ATTRIBUTE = "data-rex-script";

export const SCRIPT_STRATEGIES = ["beforeHydration", "afterHydration", "idle"] as const;
export type ScriptStrategy = (typeof SCRIPT_STRATEGIES)[number];
export const DEFAULT_SCRIPT_STRATEGY: ScriptStrategy = "afterHydration";
export const IDLE_FALLBACK_MS = 1;

export interface PriorityImage {
  readonly src: string;
  readonly srcSet: string | null;
  readonly sizes: string | null;
}

export interface RexMediaCollector {
  readonly nonce: string | null;
  preloadImage(image: PriorityImage): void;
}

export interface RexMediaRequest {
  readonly collector: RexMediaCollector;
  images(): readonly PriorityImage[];
}

export function createMediaCollector(nonce: string | null = null): RexMediaRequest {
  const images = new Map<string, PriorityImage>();
  const collector: RexMediaCollector = Object.freeze({
    nonce,
    preloadImage(image: PriorityImage) {
      const key = `${image.src}\n${image.srcSet ?? ""}\n${image.sizes ?? ""}`;
      if (!images.has(key)) images.set(key, Object.freeze({ ...image }));
    },
  });
  return Object.freeze({ collector, images: () => Object.freeze([...images.values()]) });
}

const MediaContext = createContext<RexMediaCollector | null>(null);

export interface MediaProviderProps {
  readonly value: RexMediaCollector;
  readonly children?: ReactNode;
}

export function MediaProvider({ value, children }: MediaProviderProps) {
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

type NativeImgProps = ComponentPropsWithRef<"img">;

export interface ImgProps
  extends Omit<
    NativeImgProps,
    | "src"
    | "alt"
    | "width"
    | "height"
    | "loading"
    | "decoding"
    | "fetchPriority"
    | "srcSet"
    | "sizes"
    | "children"
    | "dangerouslySetInnerHTML"
  > {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly priority?: boolean;
  readonly sizes?: string;
  readonly srcSet?: string;
  readonly loading?: "lazy" | "eager";
  readonly decoding?: "async" | "sync" | "auto";
}

function isDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function Img({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  srcSet,
  loading,
  decoding,
  ...rest
}: ImgProps) {
  if (typeof src !== "string" || src === "") {
    throw new RexError("REX314", "Img: src must be a non-empty string");
  }
  if (typeof alt !== "string") {
    throw new RexError("REX314", `Img: alt is required for ${src} (use "" for a decorative image)`);
  }
  if (!isDimension(width) || !isDimension(height)) {
    throw new RexError("REX314", `Img: width and height are required positive numbers for ${src}`);
  }
  if (priority && loading === "lazy") {
    throw new RexError("REX314", `Img: a priority image cannot load lazily (${src})`);
  }
  const media = useContext(MediaContext);
  if (priority && media !== null) {
    media.preloadImage({ src, srcSet: srcSet ?? null, sizes: sizes ?? null });
  }
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      width={width}
      height={height}
      srcSet={srcSet}
      sizes={sizes}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

const loadedScripts = new Map<string, Promise<void>>();

registerReset(() => {
  loadedScripts.clear();
});

function documentNonce(): string | null {
  const element = globalThis.document?.getElementById(REX_DATA_ELEMENT_ID);
  if (element === null || element === undefined) return null;
  const nonce = (element as HTMLElement).nonce || element.getAttribute("nonce");
  return nonce === null || nonce === "" ? null : nonce;
}

export interface LoadScriptOptions {
  readonly strategy?: ScriptStrategy;
  readonly id?: string;
  readonly nonce?: string | null;
}

export function loadScript(src: string, options: LoadScriptOptions = {}): Promise<void> {
  if (typeof src !== "string" || src === "") {
    throw new RexError("REX314", "loadScript: src must be a non-empty string");
  }
  const existing = loadedScripts.get(src);
  if (existing !== undefined) return existing;
  const document = globalThis.document;
  if (document === undefined) {
    throw new RexError("REX327", `loadScript: ${src} can only load in a browser document`);
  }
  const element = document.createElement("script");
  element.src = src;
  element.async = true;
  if (options.id !== undefined) element.id = options.id;
  const nonce = options.nonce === undefined ? documentNonce() : options.nonce;
  if (nonce !== null) element.nonce = nonce;
  element.setAttribute(SCRIPT_ATTRIBUTE, options.strategy ?? DEFAULT_SCRIPT_STRATEGY);
  const loading = new Promise<void>((resolve, reject) => {
    element.addEventListener("load", () => resolve(), { once: true });
    element.addEventListener(
      "error",
      () => {
        reject(new RexError("REX326", `Script: ${src} failed to load`));
      },
      { once: true },
    );
  });
  loading.catch(() => {});
  loadedScripts.set(src, loading);
  document.head.appendChild(element);
  return loading;
}

export interface ScriptProps {
  readonly src: string;
  readonly strategy?: ScriptStrategy;
  readonly id?: string;
  readonly onLoad?: () => void;
  readonly onError?: (error: Error) => void;
}

function subscribeNever(): () => void {
  return () => {};
}

function onClient(): boolean {
  return false;
}

function onServer(): boolean {
  return true;
}

function scheduleIdle(run: () => void): () => void {
  const idle = globalThis.requestIdleCallback;
  if (typeof idle === "function") {
    const handle = idle(run);
    return () => globalThis.cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, IDLE_FALLBACK_MS);
  return () => clearTimeout(handle);
}

export function Script({ src, strategy = DEFAULT_SCRIPT_STRATEGY, id, onLoad, onError }: ScriptProps) {
  if (typeof src !== "string" || src === "") {
    throw new RexError("REX314", "Script: src must be a non-empty string");
  }
  if (!(SCRIPT_STRATEGIES as readonly string[]).includes(strategy)) {
    throw new RexError("REX314", `Script: strategy must be one of ${SCRIPT_STRATEGIES.join(", ")}`);
  }
  const media = useContext(MediaContext);
  const fromServer = useSyncExternalStore(subscribeNever, onClient, onServer);
  const [serverRendered] = useState(fromServer);
  const loaded = useEffectEvent(() => {
    onLoad?.();
  });
  const failed = useEffectEvent((error: Error) => {
    onError?.(error);
  });

  useEffect(() => {
    if (strategy === "beforeHydration" && serverRendered) {
      if (!loadedScripts.has(src)) loadedScripts.set(src, Promise.resolve());
      loaded();
      return;
    }
    let active = true;
    const run = () => {
      loadScript(src, id === undefined ? { strategy } : { strategy, id }).then(
        () => {
          if (active) loaded();
        },
        (error: unknown) => {
          if (active) failed(error instanceof Error ? error : new Error(String(error)));
        },
      );
    };
    const cancel = strategy === "idle" ? scheduleIdle(run) : (run(), () => {});
    return () => {
      active = false;
      cancel();
    };
  }, [src, strategy, id, serverRendered]);

  if (strategy !== "beforeHydration" || !serverRendered) return null;
  const nonce = media === null ? documentNonce() : media.nonce;
  return (
    <script
      src={src}
      id={id}
      nonce={nonce ?? undefined}
      suppressHydrationWarning
      {...{ [SCRIPT_ATTRIBUTE]: strategy }}
    />
  );
}

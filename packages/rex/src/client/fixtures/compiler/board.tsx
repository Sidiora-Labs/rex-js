import { Profiler, useSyncExternalStore, type ProfilerOnRenderCallback } from "react";

export interface PriceStore {
  get(): number;
  set(value: number): void;
  subscribe(listener: () => void): () => void;
}

export function createPriceStore(initial: number): PriceStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function Title({ text }: { readonly text: string }) {
  return <h2>{text}</h2>;
}

export function Price({ value }: { readonly value: number }) {
  return <p>Price {value}</p>;
}

export interface BoardProps {
  readonly store: PriceStore;
  readonly title: string;
  readonly onRender: ProfilerOnRenderCallback;
}

export function Board({ store, title, onRender }: BoardProps) {
  const value = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <section>
      <Profiler id="title" onRender={onRender}>
        <Title text={title} />
      </Profiler>
      <Profiler id="price" onRender={onRender}>
        <Price value={value} />
      </Profiler>
    </section>
  );
}

import { useQueryClient, type Query } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useState, type ReactNode } from "react";
import type { AuditRecord } from "../../server/audit.ts";
import { usePageDataState, useSidecarPayload } from "../agent/sidecar.tsx";
import { useManifest } from "../context.ts";
import type { PageResolution } from "../router.tsx";
import { DEVTOOLS_AUDIT_PATH } from "./env.ts";
import type { DevtoolsSnapshot } from "./store.ts";

export const LOADER_QUERY_SCOPE = "loader";

function json(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "undefined";
  } catch (error) {
    return `unserialisable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function ms(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function NoPage() {
  return <p>No page is active.</p>;
}

export function useQueryCacheEntries(): readonly Query[] {
  const cache = useQueryClient().getQueryCache();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  useEffect(() => cache.subscribe(() => refresh()), [cache]);
  return cache.getAll();
}

export function ManifestPanel() {
  const manifest = useManifest();
  return (
    <div data-rex-devtools-content="manifest">
      <dl>
        <dt>App</dt>
        <dd>{manifest.app.name}</dd>
        <dt>Pages</dt>
        <dd>{manifest.pages.map((entry) => entry.id).join(", ") || "none"}</dd>
        <dt>Actions</dt>
        <dd>{manifest.actions.map((entry) => entry.id).join(", ") || "none"}</dd>
        <dt>Entities</dt>
        <dd>{manifest.entities.map((entry) => entry.id).join(", ") || "none"}</dd>
      </dl>
      <pre>{json(manifest)}</pre>
    </div>
  );
}

function loaderStatus(queries: readonly Query[], pageId: string, name: string): string {
  const matching = queries.filter(
    (query) =>
      query.queryKey[0] === LOADER_QUERY_SCOPE &&
      query.queryKey[1] === pageId &&
      query.queryKey[2] === name,
  );
  if (matching.length === 0) return "not loaded";
  return matching.map((query) => `${query.state.status} (${query.state.fetchStatus})`).join(", ");
}

function ActivePagePanel({ resolution }: { readonly resolution: PageResolution }) {
  const state = usePageDataState(resolution);
  const queries = useQueryCacheEntries();
  const declared = resolution.page;
  return (
    <div data-rex-devtools-content="page">
      <dl>
        <dt>Page</dt>
        <dd>{declared.id}</dd>
        <dt>Route</dt>
        <dd>{declared.route}</dd>
        <dt>State</dt>
        <dd data-rex-devtools-state="">{state}</dd>
        <dt>Policy</dt>
        <dd>
          {resolution.policy.allowed ? "allowed" : `denied: ${resolution.policy.reason ?? ""}`}
        </dd>
      </dl>
      <h3>Params</h3>
      <pre data-rex-devtools-params="">{json(resolution.params)}</pre>
      <h3>Loaders</h3>
      {declared.loaders.length === 0 ? (
        <p>This page declares no loaders.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Loader</th>
              <th scope="col">Action</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {declared.loaders.map((loader) => (
              <tr key={loader.name} data-rex-devtools-loader={loader.name}>
                <td>{loader.name}</td>
                <td>{loader.action.id}</td>
                <td>{loaderStatus(queries, declared.id, loader.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function PagePanel({ resolution }: { readonly resolution: PageResolution | null }) {
  return resolution === null ? <NoPage /> : <ActivePagePanel resolution={resolution} />;
}

function ActiveSidecarPanel({ resolution }: { readonly resolution: PageResolution }) {
  const payload = useSidecarPayload(resolution);
  return <pre data-rex-devtools-content="sidecar">{json(payload)}</pre>;
}

export function SidecarPanel({ resolution }: { readonly resolution: PageResolution | null }) {
  return resolution === null ? <NoPage /> : <ActiveSidecarPanel resolution={resolution} />;
}

export function OutcomesPanel({ snapshot }: { readonly snapshot: DevtoolsSnapshot }) {
  if (snapshot.outcomes.length === 0) return <p>No outcomes yet.</p>;
  return (
    <ol data-rex-devtools-content="outcomes" reversed>
      {[...snapshot.outcomes].reverse().map(({ sequence, page, outcome }) => (
        <li key={sequence} data-rex-devtools-outcome={outcome.actionId}>
          <time dateTime={outcome.at}>{outcome.at}</time> {page} {outcome.actionId}{" "}
          {outcome.ok ? "ok" : "failed"}: {outcome.message}
        </li>
      ))}
    </ol>
  );
}

export function QueriesPanel() {
  const queries = useQueryCacheEntries();
  if (queries.length === 0) return <p>The query cache is empty.</p>;
  return (
    <ul data-rex-devtools-content="queries">
      {queries.map((query) => (
        <li key={query.queryHash} data-rex-devtools-query={query.queryHash}>
          <code>{query.queryHash}</code> {query.state.status} {query.state.fetchStatus}, observers{" "}
          {query.getObserversCount()}
          <pre>{json(query.state.data)}</pre>
        </li>
      ))}
    </ul>
  );
}

export function RendersPanel({ snapshot }: { readonly snapshot: DevtoolsSnapshot }) {
  if (snapshot.renders.length === 0) return <p>No region has rendered yet.</p>;
  return (
    <table data-rex-devtools-content="renders">
      <thead>
        <tr>
          <th scope="col">Region</th>
          <th scope="col">Commits</th>
          <th scope="col">Last</th>
          <th scope="col">Max</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {snapshot.renders.map((entry) => (
          <tr key={entry.address} data-rex-devtools-render={entry.address}>
            <td>{entry.address}</td>
            <td>{entry.commits}</td>
            <td>{ms(entry.lastMs)}</td>
            <td>{ms(entry.maxMs)}</td>
            <td>{ms(entry.totalMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type AuditTail =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly records: readonly AuditRecord[] }
  | { readonly status: "error"; readonly message: string };

export function auditUrl(): string {
  const base = globalThis.location?.href;
  if (typeof base !== "string") throw new Error("rex devtools: the audit tail needs a location");
  return new URL(DEVTOOLS_AUDIT_PATH, base).toString();
}

async function fetchAuditTail(signal: AbortSignal): Promise<readonly AuditRecord[]> {
  const response = await globalThis.fetch(auditUrl(), {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`GET ${DEVTOOLS_AUDIT_PATH} answered ${response.status}`);
  }
  const body = (await response.json()) as { readonly records?: unknown };
  if (!Array.isArray(body.records)) {
    throw new Error(`GET ${DEVTOOLS_AUDIT_PATH} returned no records list`);
  }
  return body.records as readonly AuditRecord[];
}

export function AuditPanel() {
  const [tail, setTail] = useState<AuditTail>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setTail({ status: "loading" });
    fetchAuditTail(controller.signal).then(
      (records) => {
        if (!controller.signal.aborted) setTail({ status: "ready", records });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setTail({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  let body: ReactNode;
  if (tail.status === "loading") {
    body = <p role="status">Loading the audit tail</p>;
  } else if (tail.status === "error") {
    body = <p role="alert">{tail.message}</p>;
  } else if (tail.records.length === 0) {
    body = <p>The audit ledger is empty.</p>;
  } else {
    body = (
      <ol data-rex-devtools-content="audit">
        {tail.records.map((record) => (
          <li key={record.id} data-rex-devtools-audit={record.id}>
            <time dateTime={record.at}>{record.at}</time> {record.actor} {record.actionId}{" "}
            {record.effect} {record.outcome} {ms(record.durationMs)}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div>
      <button type="button" onClick={refresh}>
        Refresh audit
      </button>
      {body}
    </div>
  );
}

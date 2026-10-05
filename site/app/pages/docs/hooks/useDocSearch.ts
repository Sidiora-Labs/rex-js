import { actionAddress } from "@sidioralabs/rex";
import { useOutcomeStore, useRegisterAffordances, type Affordance } from "@sidioralabs/rex/client";
import { useCallback, useMemo, useRef, useState } from "react";
import docsPage from "../page.ts";

const searchDocs = (() => {
  const declared = docsPage.affordances.find((entry) => entry.id === "search-docs");
  if (declared === undefined) throw new Error("The docs page must declare search-docs");
  return declared;
})();

export function useDocSearch(available: boolean) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const outcomes = useOutcomeStore();
  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      outcomes.set("docs", {
        actionId: "search-docs",
        ok: true,
        message: value === "" ? "Search cleared" : `Searching docs for ${value}`,
        at: new Date().toISOString(),
      });
    },
    [outcomes],
  );
  const invoke = useCallback(
    async (value: unknown) => {
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).some((key) => key !== "query") ||
        ("query" in value && typeof value.query !== "string")
      ) {
        outcomes.set("docs", {
          actionId: "search-docs",
          ok: false,
          message: "Search expects an optional string query",
          at: new Date().toISOString(),
        });
        return;
      }
      if ("query" in value && typeof value.query === "string") onQueryChange(value.query);
      else
        outcomes.set("docs", {
          actionId: "search-docs",
          ok: true,
          message: "Search focused",
          at: new Date().toISOString(),
        });
      inputRef.current?.focus();
    },
    [onQueryChange, outcomes],
  );
  const affordances = useMemo<readonly Affordance[]>(
    () => [{ ...searchDocs, allowed: true, reason: null, invoke }],
    [invoke],
  );
  useRegisterAffordances(available ? "docs" : null, affordances);
  return { query, inputRef, onQueryChange, address: actionAddress("docs", "search-docs") };
}

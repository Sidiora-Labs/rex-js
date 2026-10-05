import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { navigate } from "wouter/use-browser-location";
import { actor } from "../../../core/actor.ts";
import { page } from "../../../core/page.ts";
import { createRegistry } from "../../../core/registry.ts";
import { buildManifest } from "../../../manifest/build.ts";
import { createRexApp } from "../../app.tsx";
import { useNav } from "../../nav.ts";
import { definePageModules, view } from "../../page.tsx";
import { Shell } from "../../shell.tsx";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const first = page("first", {
  route: "/first",
  chrome: { title: "First" },
  transition: "view",
  states: ["ready"],
});
const second = page("second", {
  route: "/second",
  chrome: { title: "Second" },
  transition: "view",
  states: ["ready"],
});
const ordinary = page("ordinary", {
  route: "/ordinary",
  chrome: { title: "Ordinary" },
  states: ["ready"],
});
const registry = createRegistry().register(home, first, second, ordinary).freeze();
const manifest = buildManifest(registry);
const RexApp = createRexApp({
  registry,
  manifest,
  actor: actor({ id: "reader" }),
  baseUrl: location.origin,
});

function Controls() {
  const nav = useNav();
  return (
    <div>
      <button id="first" onClick={() => nav.to(first)}>
        First transition
      </button>
      <button id="second" onClick={() => nav.to(second)}>
        Second transition
      </button>
      <button id="ordinary" onClick={() => nav.to(ordinary)}>
        Ordinary navigation
      </button>
      <button id="replace" onClick={() => nav.replace(ordinary)}>
        Replace navigation
      </button>
      <button id="external" onClick={() => flushSync(() => navigate("/ordinary"))}>
        External navigation
      </button>
    </div>
  );
}

const pages = [home, first, second, ordinary].map((declared) =>
  definePageModules({
    page: declared,
    view: view(() => <Controls />),
    states: {},
  }),
);

function App() {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button id="unmount" onClick={() => flushSync(() => setMounted(false))}>
        Unmount routes
      </button>
      {mounted && (
        <RexApp>
          <Shell pages={pages} />
        </RexApp>
      )}
    </>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("Missing root");
createRoot(root).render(<App />);

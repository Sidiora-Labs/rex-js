import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { RexError } from "../../core/errors.ts";
import { createRexEntry, type RexEntryBundle, type RexEntryOptions } from "../entry.tsx";
import { pageHref } from "../router.tsx";

export interface MountRexPageOptions extends RexEntryOptions {
  readonly params?: Readonly<Record<string, unknown>>;
}

export type UnmountRexPage = () => void;

export function mountRexPage(
  element: Element,
  app: RexEntryBundle,
  pageId: string,
  options: MountRexPageOptions = {},
): UnmountRexPage {
  const Host = globalThis.Element;
  if (Host === undefined || !(element instanceof Host)) {
    throw new RexError("REX329", "mountRexPage: element must be a DOM element");
  }
  if (typeof app !== "object" || app === null || app.registry === undefined) {
    throw new RexError(
      "REX313",
      "mountRexPage: the rex:app bundle with registry and pages is required",
    );
  }
  const declared = app.registry.find("page", pageId);
  if (declared === undefined) {
    throw new RexError("REX301", `mountRexPage: page "${pageId}" is not registered in this app`);
  }
  const { params = {}, ...entryOptions } = options;
  const href = pageHref(declared, params);
  if (!href.ok) {
    throw new RexError(
      "REX331",
      `mountRexPage: invalid params for page "${pageId}": ${href.issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`,
    );
  }
  const RexEntry = createRexEntry(app, entryOptions);
  const location = memoryLocation({ path: href.href });
  const root = createRoot(element);
  root.render(
    <Router hook={location.hook}>
      <RexEntry />
    </Router>,
  );
  let mounted = true;
  return () => {
    if (!mounted) return;
    mounted = false;
    root.unmount();
  };
}

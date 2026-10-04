import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REX_DATA_ELEMENT_ID, REX_DATA_MIME_TYPE } from "./hydrate.ts";
import {
  DEFAULT_SCRIPT_STRATEGY,
  Img,
  MediaProvider,
  SCRIPT_ATTRIBUTE,
  SCRIPT_STRATEGIES,
  Script,
  createMediaCollector,
  loadScript,
  type ImgProps,
  type ScriptStrategy,
} from "./media.tsx";
import { resetAll } from "./reset.ts";

const NONCE = "0123456789abcdef0123456789abcdef";

function installNonce(nonce: string = NONCE): void {
  const data = document.createElement("script");
  data.type = REX_DATA_MIME_TYPE;
  data.id = REX_DATA_ELEMENT_ID;
  data.setAttribute("nonce", nonce);
  data.textContent = "{}";
  document.head.appendChild(data);
}

function headScripts(src: string): HTMLScriptElement[] {
  return [
    ...document.head.querySelectorAll<HTMLScriptElement>(`script[${SCRIPT_ATTRIBUTE}]`),
  ].filter((element) => element.getAttribute("src") === src);
}

afterEach(() => {
  cleanup();
  resetAll();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("Img", () => {
  it("lazy-loads and decodes asynchronously by default with its intrinsic size", () => {
    const { container } = render(
      <Img
        src="/images/card.avif"
        alt="Card art"
        width={640}
        height={360}
        sizes="(max-width: 640px) 100vw, 640px"
        srcSet="/images/card-320.avif 320w, /images/card-640.avif 640w"
        className="card-art"
      />,
    );
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("/images/card.avif");
    expect(image?.getAttribute("alt")).toBe("Card art");
    expect(image?.getAttribute("width")).toBe("640");
    expect(image?.getAttribute("height")).toBe("360");
    expect(image?.getAttribute("loading")).toBe("lazy");
    expect(image?.getAttribute("decoding")).toBe("async");
    expect(image?.getAttribute("sizes")).toBe("(max-width: 640px) 100vw, 640px");
    expect(image?.getAttribute("srcset")).toBe(
      "/images/card-320.avif 320w, /images/card-640.avif 640w",
    );
    expect(image?.getAttribute("class")).toBe("card-art");
    expect(image?.hasAttribute("fetchpriority")).toBe(false);
  });

  it("loads a priority image eagerly with high fetch priority and lets loading and decoding be overridden", () => {
    const { container } = render(
      <>
        <Img src="/images/hero.avif" alt="" width={1200} height={630} priority />
        <Img
          src="/images/inline.avif"
          alt="Inline"
          width={10}
          height={10}
          loading="eager"
          decoding="sync"
        />
      </>,
    );
    const [hero, inline] = [...container.querySelectorAll("img")];
    expect(hero?.getAttribute("fetchpriority")).toBe("high");
    expect(hero?.getAttribute("loading")).toBe("eager");
    expect(hero?.getAttribute("decoding")).toBe("async");
    expect(hero?.getAttribute("alt")).toBe("");
    expect(inline?.getAttribute("loading")).toBe("eager");
    expect(inline?.getAttribute("decoding")).toBe("sync");
    expect(inline?.hasAttribute("fetchpriority")).toBe(false);
  });

  it("registers each priority image once with the server media collector", () => {
    const media = createMediaCollector(NONCE);
    const html = renderToString(
      <MediaProvider value={media.collector}>
        <Img
          src="/images/hero.avif"
          srcSet="/images/hero-2x.avif 2x"
          alt="Hero"
          width={1200}
          height={630}
          priority
        />
        <Img
          src="/images/hero.avif"
          srcSet="/images/hero-2x.avif 2x"
          alt="Hero again"
          width={1200}
          height={630}
          priority
        />
        <Img src="/images/below.avif" alt="Below the fold" width={600} height={400} />
      </MediaProvider>,
    );
    expect(html).toContain('src="/images/below.avif"');
    expect(media.images()).toEqual([
      { src: "/images/hero.avif", srcSet: "/images/hero-2x.avif 2x", sizes: null },
    ]);
    expect(media.collector.nonce).toBe(NONCE);
  });

  it("refuses an image without a size, alt text or with a lazy priority", () => {
    const invalid: readonly [Partial<ImgProps>, string][] = [
      [
        { src: "/a.png", alt: "a", height: 10 },
        "Img: width and height are required positive numbers for /a.png",
      ],
      [
        { src: "/a.png", alt: "a", width: 10, height: 0 },
        "Img: width and height are required positive numbers for /a.png",
      ],
      [
        { src: "/a.png", width: 10, height: 10 },
        'Img: alt is required for /a.png (use "" for a decorative image)',
      ],
      [{ src: "", alt: "a", width: 10, height: 10 }, "Img: src must be a non-empty string"],
      [
        { src: "/a.png", alt: "a", width: 10, height: 10, priority: true, loading: "lazy" },
        "Img: a priority image cannot load lazily (/a.png)",
      ],
    ];
    for (const [props, message] of invalid) {
      expect(() => renderToString(createElement(Img, props as ImgProps))).toThrow(message);
    }
  });
});

describe("Script", () => {
  it("declares the three loading strategies with afterHydration as the default", () => {
    expect(SCRIPT_STRATEGIES).toEqual(["beforeHydration", "afterHydration", "idle"]);
    expect(DEFAULT_SCRIPT_STRATEGY).toBe("afterHydration");
  });

  it("injects an async script with the document nonce after mount, once per source", async () => {
    installNonce();
    const { container } = render(
      <>
        <Script src="/vendor/analytics.js" id="analytics" />
        <Script src="/vendor/analytics.js" />
      </>,
    );
    expect(container.querySelector("script")).toBeNull();
    const injected = headScripts("/vendor/analytics.js");
    expect(injected).toHaveLength(1);
    const element = injected[0] as HTMLScriptElement;
    expect(element.async).toBe(true);
    expect(element.id).toBe("analytics");
    expect(element.nonce || element.getAttribute("nonce")).toBe(NONCE);
    expect(element.getAttribute(SCRIPT_ATTRIBUTE)).toBe("afterHydration");
  });

  it("reports a script that fails to load through onError, once per source", async () => {
    const failures: Error[] = [];
    const first = render(
      <Script
        src="/vendor/broken.js"
        onError={(error) => {
          failures.push(error);
        }}
      />,
    );
    await waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0]?.message).toBe("REX326 Script: /vendor/broken.js failed to load");
    first.unmount();
    render(
      <Script
        src="/vendor/broken.js"
        onError={(error) => {
          failures.push(error);
        }}
      />,
    );
    await waitFor(() => expect(failures).toHaveLength(2));
    expect(failures[1]?.message).toBe("REX326 Script: /vendor/broken.js failed to load");
    expect(headScripts("/vendor/broken.js")).toHaveLength(1);
  });

  it("waits for the browser to be idle before loading an idle script", async () => {
    render(<Script src="/vendor/chat.js" strategy="idle" />);
    expect(headScripts("/vendor/chat.js")).toHaveLength(0);
    await waitFor(() => expect(headScripts("/vendor/chat.js")).toHaveLength(1));
    expect(headScripts("/vendor/chat.js")[0]?.getAttribute(SCRIPT_ATTRIBUTE)).toBe("idle");
  });

  it("does not load an idle script whose component unmounted first", async () => {
    const { unmount } = render(<Script src="/vendor/never.js" strategy="idle" />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(headScripts("/vendor/never.js")).toHaveLength(0);
  });

  it("server-renders a beforeHydration script with the request nonce and keeps it on hydration", async () => {
    const media = createMediaCollector(NONCE);
    const html = renderToString(
      <MediaProvider value={media.collector}>
        <Script src="/vendor/consent.js" strategy="beforeHydration" />
      </MediaProvider>,
    );
    expect(html).toBe(
      `<script src="/vendor/consent.js" nonce="${NONCE}" ${SCRIPT_ATTRIBUTE}="beforeHydration"></script>`,
    );

    installNonce();
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const serverScript = container.querySelector("script");
    serverScript?.replaceChildren();
    const loaded: string[] = [];
    const errors = vi.spyOn(console, "error");
    const root = await act(async () =>
      hydrateRoot(
        container,
        <Script
          src="/vendor/consent.js"
          strategy="beforeHydration"
          onLoad={() => loaded.push("consent")}
        />,
      ),
    );
    expect(container.querySelector("script")).toBe(serverScript);
    expect(loaded).toEqual(["consent"]);
    expect(headScripts("/vendor/consent.js")).toHaveLength(0);
    expect(errors.mock.calls).toEqual([]);
    await act(async () => {
      root.unmount();
    });
    errors.mockRestore();
  });

  it("loads a beforeHydration script itself when the page renders on the client", () => {
    installNonce();
    const { container } = render(<Script src="/vendor/consent.js" strategy="beforeHydration" />);
    expect(container.querySelector("script")).toBeNull();
    const injected = headScripts("/vendor/consent.js");
    expect(injected).toHaveLength(1);
    expect(injected[0]?.getAttribute(SCRIPT_ATTRIBUTE)).toBe("beforeHydration");
  });

  it("refuses an unknown strategy and an empty source", () => {
    expect(() =>
      renderToString(<Script src="/x.js" strategy={"eager" as ScriptStrategy} />),
    ).toThrow("Script: strategy must be one of beforeHydration, afterHydration, idle");
    expect(() => renderToString(<Script src="" />)).toThrow(
      "Script: src must be a non-empty string",
    );
    expect(() => loadScript("")).toThrow("loadScript: src must be a non-empty string");
  });
});

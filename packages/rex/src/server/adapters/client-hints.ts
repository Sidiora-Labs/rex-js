import type { Hono } from "hono";

export const CLIENT_HINT_HEADERS = Object.freeze({
  mobile: "sec-ch-ua-mobile",
  viewportWidth: "sec-ch-viewport-width",
  userAgent: "user-agent",
} as const);

export const ACCEPT_CH_HEADER = "accept-ch";
export const ACCEPT_CH = "Sec-CH-UA-Mobile, Sec-CH-Viewport-Width";
export const CLIENT_HINT_VARY = ["Sec-CH-UA-Mobile", "Sec-CH-Viewport-Width"] as const;

const HTML_TYPE = /^text\/html\b/i;

export function isDocumentResponse(response: Response): boolean {
  return HTML_TYPE.test(response.headers.get("content-type") ?? "");
}

export function applyClientHints(headers: Headers): void {
  headers.set(ACCEPT_CH_HEADER, ACCEPT_CH);
  const vary = (headers.get("vary") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const known = new Set(vary.map((entry) => entry.toLowerCase()));
  for (const name of CLIENT_HINT_VARY) {
    if (!known.has(name.toLowerCase())) vary.push(name);
  }
  headers.set("vary", vary.join(", "));
}

export function withClientHints(response: Response): Response {
  const hinted = new Response(response.body, response);
  applyClientHints(hinted.headers);
  return hinted;
}

export function installClientHints(app: Hono): void {
  app.use("*", async (c, next) => {
    await next();
    if (!isDocumentResponse(c.res)) return;
    c.res = new Response(c.res.body, c.res);
    applyClientHints(c.res.headers);
  });
}

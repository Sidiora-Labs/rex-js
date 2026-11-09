import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { DESIGNX_LOCK } from "../../designx.ts";

export const DESIGNX_REGISTRY_PATH = "/r";

export type DesignxRegistryAnswer = string | number;

export interface DesignxRegistryFixture {
  readonly registry: string;
  readonly requested: readonly string[];
  close(): Promise<void>;
}

const ITEM_PATH = /^\/r\/([a-z][a-z0-9-]*)\.json$/;
const CORS = { "access-control-allow-origin": "*" } as const;

function answerFor(
  name: string,
  answers: Readonly<Record<string, DesignxRegistryAnswer>>,
): DesignxRegistryAnswer {
  if (Object.hasOwn(answers, name)) return answers[name] ?? 404;
  return Object.hasOwn(DESIGNX_LOCK.items, name) ? (DESIGNX_LOCK.items[name]?.vendored ?? 404) : 404;
}

export async function serveDesignxRegistry(
  answers: Readonly<Record<string, DesignxRegistryAnswer>> = {},
): Promise<DesignxRegistryFixture> {
  const requested: string[] = [];
  const server = createServer((request, response) => {
    const name = ITEM_PATH.exec(request.url ?? "")?.[1];
    if (request.method === "OPTIONS" && name !== undefined) {
      response.writeHead(204, CORS).end();
      return;
    }
    if (request.method !== "GET" || name === undefined) {
      response.writeHead(404).end();
      return;
    }
    requested.push(name);
    const answer = answerFor(name, answers);
    if (typeof answer === "number") {
      response.writeHead(answer, CORS).end();
      return;
    }
    response
      .writeHead(200, { ...CORS, "content-type": "application/json; charset=utf-8" })
      .end(answer);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  return {
    registry: `http://127.0.0.1:${port}${DESIGNX_REGISTRY_PATH}`,
    requested,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}

export async function unreachableDesignxRegistry(): Promise<string> {
  const fixture = await serveDesignxRegistry();
  await fixture.close();
  return fixture.registry;
}

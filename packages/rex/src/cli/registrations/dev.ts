import { InvalidArgumentError, type RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export const DEFAULT_DEV_PORT = 5173;

export function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new InvalidArgumentError("the port must be an integer from 0 to 65535");
  }
  return port;
}

export function register(program: RexCommand, io: RexCliIO): void {
  program
    .command("dev")
    .description("serve the Vite client and the app's Hono server on one port with hot reload")
    .option("--port <port>", "port to listen on", parsePort, DEFAULT_DEV_PORT)
    .option("--host <host>", "host to listen on")
    .option("--no-check", "start without running rex check first")
    .action(async (options: { port: number; host?: string; check: boolean }) => {
      const { executeDev } = await import("../commands/dev.ts");
      await executeDev(options, io);
    });
}

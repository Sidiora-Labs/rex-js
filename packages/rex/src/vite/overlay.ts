import { normalizePath, type ErrorPayload, type Plugin, type ViteDevServer } from "vite";
import { fileFrame } from "../cli/frame.ts";
import { errorHint } from "../core/errors.docs.ts";
import {
  isRexError,
  locateRexError,
  stackFrames,
  type RexError,
  type RexStackFrame,
} from "../core/errors.ts";
import type { RexHookContext } from "./hooks.ts";
import { APP_MODULE_ID } from "./virtual.ts";

export const OVERLAY_PLUGIN = "rex";

export type OverlayError = ErrorPayload["err"];

export type FixStacktrace = (error: Error) => void;

export function appStackFrame(stack: string | undefined, appPath: string): RexStackFrame | null {
  const prefix = `${normalizePath(appPath)}/`;
  for (const frame of stackFrames(stack)) {
    const file = normalizePath(frame.file.split("?")[0] ?? frame.file);
    if (file.startsWith(prefix)) return { ...frame, file };
  }
  return null;
}

export function locateAppError<E>(error: E, appPath: string, fixStacktrace?: FixStacktrace): E {
  if (!isRexError(error)) return error;
  fixStacktrace?.(error);
  if (error.file !== null) return error;
  const frame = appStackFrame(error.stack, appPath);
  if (frame !== null) locateRexError(error, frame);
  return error;
}

export function overlayError(error: RexError): OverlayError {
  const frame = fileFrame(error);
  return {
    message: error.message,
    stack: error.stack ?? "",
    plugin: OVERLAY_PLUGIN,
    ...(error.file === null ? {} : { id: error.file }),
    ...(frame === "" ? {} : { frame }),
    ...(error.file === null || error.line === null
      ? {}
      : { loc: { file: error.file, line: error.line, column: error.column ?? 1 } }),
  };
}

export function attachOverlayFields(error: RexError): RexError {
  const fields = overlayError(error);
  for (const key of ["id", "frame", "loc", "plugin"] as const) {
    if (fields[key] === undefined) continue;
    Object.defineProperty(error, key, {
      value: fields[key],
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return error;
}

export function reportAppError(vite: ViteDevServer, error: unknown, appPath: string): boolean {
  const located = locateAppError(error, appPath, (target) => vite.ssrFixStacktrace(target));
  if (!isRexError(located)) return false;
  attachOverlayFields(located);
  const payload = overlayError(located);
  const where = payload.loc === undefined ? "" : ` (${payload.loc.file}:${payload.loc.line})`;
  vite.config.logger.error(`${located.message}${where}\n  hint: ${errorHint(located)}`, {
    timestamp: true,
  });
  vite.environments.client.hot.send({ type: "error", err: payload });
  return true;
}

export async function checkAppModules(
  vite: ViteDevServer,
  appPath: string,
  specifier: string = APP_MODULE_ID,
): Promise<RexError | null> {
  try {
    await vite.ssrLoadModule(specifier, { fixStacktrace: true });
    return null;
  } catch (error) {
    if (!reportAppError(vite, error, appPath)) return null;
    return error as RexError;
  }
}

export function overlayHook(context: RexHookContext): Plugin {
  return {
    name: "rex:overlay",
    apply: "serve",
    configureServer(vite) {
      vite.environments.client.hot.on("connection", () => {
        void checkAppModules(vite, context.appPath());
      });
      return () => {
        vite.middlewares.use((error: unknown, _req: unknown, _res: unknown, next: (error?: unknown) => void) => {
          if (isRexError(error)) {
            locateAppError(error, context.appPath(), (target) => vite.ssrFixStacktrace(target));
            attachOverlayFields(error);
          }
          next(error);
        });
      };
    },
  };
}

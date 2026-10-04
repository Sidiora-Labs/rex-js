import { errorDocs, type RexErrorCode } from "./errors.ts";

export type DeprecationWarn = (message: string) => void;

const warned = new Set<RexErrorCode>();

function consoleWarn(message: string): void {
  console.warn(message);
}

export function deprecationMessage(code: RexErrorCode, message: string): string {
  return `rex: ${code} deprecated: ${message} (${errorDocs(code)})`;
}

export function deprecated(
  code: RexErrorCode,
  message: string,
  warn: DeprecationWarn = consoleWarn,
): boolean {
  if (warned.has(code)) return false;
  warned.add(code);
  warn(deprecationMessage(code, message));
  return true;
}

export function hasWarned(code: RexErrorCode): boolean {
  return warned.has(code);
}

export function resetDeprecations(): void {
  warned.clear();
}

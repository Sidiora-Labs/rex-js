const INLINE_ESCAPES: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

const INLINE_UNSAFE = /[<>&\u2028\u2029]/g;

export function escapeInlineJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError("escapeInlineJson: the value has no JSON representation");
  }
  return json.replace(INLINE_UNSAFE, (character) => INLINE_ESCAPES[character] as string);
}

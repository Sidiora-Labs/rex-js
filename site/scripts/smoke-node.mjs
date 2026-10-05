import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let errors = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  errors += chunk;
});
const closed = new Promise((resolve) => child.once("close", resolve));
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error(`Server startup timed out\n${output}${errors}`)),
    30_000,
  );
  child.once("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.once("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`Server exited ${code}\n${output}${errors}`));
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    const match = /^rex: serving (http:\/\/[^\s]+)$/m.exec(output);
    if (match !== null) {
      clearTimeout(timer);
      resolve(match[1]);
    }
  });
});

try {
  const origin = await ready;
  for (const [path, status, marker] of [
    ["/rex/health", 200, null],
    ["/rex/manifest", 200, '"pages"'],
    ["/", 200, 'data-rex-page="home"'],
    ["/docs", 200, 'data-rex-page="docs"'],
    ["/__rex_missing_startup_probe__", 404, null],
  ]) {
    const response = await fetch(new URL(path, origin), {
      headers: { accept: path.startsWith("/rex/") ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    assert.equal(response.status, status, `${path}: ${body.slice(0, 500)}\n${errors}`);
    if (marker !== null) assert.ok(body.includes(marker), `${path}: missing ${marker}`);
    if (status === 200)
      assert.ok(!body.includes("data-rex-error-code"), `${path}: framework error document`);
    console.log(`node startup: ${path} ${status}`);
  }
  console.log("node startup: passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await closed;
  clearTimeout(timer);
}

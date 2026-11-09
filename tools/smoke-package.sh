#!/usr/bin/env sh
# Package smoke test: install a packed @sidioralabs/rex tarball into a scratch
# package, write a fresh app with its rex bin, install the tarball into that app,
# run rex check and rex build, start the built Node server on a free port and
# fetch the home page, the manifest and one RPC call from it. Before the app, it runs
# tools/package-exports.test.mjs on the tarball, which imports every export. It also
# runs the default rex new path with networking to the DesignX registry host disabled
# and without prettier, installs that app against the tarball and runs rex check on it.
# Usage: tools/smoke-package.sh [tarball]; without a tarball, packages/rex is packed.
set -eu
cd "$(dirname "$0")/.."
root="$(pwd)"

package="@sidioralabs/rex"
app_name="my-app"
designx_app_name="my-designx-app"
start_attempts=60

fail() {
  echo "smoke-package: $*" >&2
  exit 1
}

step() {
  echo "smoke-package: $*"
}

work="$(mktemp -d "${TMPDIR:-/tmp}/rex-smoke.XXXXXX")"
server_pid=""

cleanup() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[ "$#" -le 1 ] || fail "usage: tools/smoke-package.sh [tarball]"
if [ "$#" -eq 1 ]; then
  case "$1" in
    /*) tarball="$1" ;;
    *) tarball="$root/$1" ;;
  esac
else
  step "packing packages/rex"
  pnpm -C packages/rex pack --pack-destination "$work/pack" >/dev/null
  set -- "$work"/pack/*.tgz
  [ "$#" -eq 1 ] && [ -f "$1" ] || fail "expected exactly one tarball in $work/pack"
  tarball="$1"
fi
[ -f "$tarball" ] || fail "tarball not found: $tarball"

step "importing every export of $tarball with its peers"
REX_PACKAGE_TARBALL="$tarball" node --test tools/package-exports.test.mjs

step "reading the peers the rex bin loads from $tarball"
mkdir -p "$work/extract"
tar -xzf "$tarball" -C "$work/extract"
bin_peers="$(node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const root = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s*"([^"]+)"|(?:^|\n)\s*import\s*"([^"]+)"/g;
  const seen = new Set();
  const bare = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const match of fs.readFileSync(file, "utf8").matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (fs.existsSync(target)) walk(target);
      } else if (!specifier.startsWith("node:")) {
        const parts = specifier.split("/");
        bare.add(parts.slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
      }
    }
  };
  for (const bin of Object.values(manifest.bin)) {
    const entry = path.resolve(root, bin);
    walk(entry);
    const commands = path.join(path.dirname(entry), "commands");
    for (const name of fs.readdirSync(commands)) {
      if (name.endsWith(".js")) walk(path.join(commands, name));
    }
  }
  const peers = Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => bare.has(name));
  console.log(peers.map(([name, range]) => `${name}@${range}`).join("\n"));
' "$work/extract/package")"
[ -n "$bin_peers" ] || fail "no peer of $package is imported by its bin"
echo "$bin_peers"

scratch="$work/scratch"
mkdir -p "$scratch"
printf '{ "name": "rex-smoke-scratch", "private": true, "type": "module" }\n' > "$scratch/package.json"
step "installing $tarball and the bin peers into $scratch"
(cd "$scratch" && pnpm add "$tarball" $bin_peers)

point_at_tarball() {
  node -e '
    const fs = require("node:fs");
    const [file, name, tarball] = process.argv.slice(1);
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    if (manifest.dependencies?.[name] === undefined) {
      console.error(`${file} does not depend on ${name}`);
      process.exit(1);
    }
    manifest.dependencies[name] = `file:${tarball}`;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  ' "$1/package.json" "$package" "$tarball"
}

step "reading the DesignX registry host from the lock file in $tarball"
lock_file="$work/extract/package/dist/cli/designx.lock.json"
[ -f "$lock_file" ] || fail "$tarball does not ship dist/cli/designx.lock.json"
registry_host="$(node -e '
  const lock = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const hosts = new Set(Object.values(lock.items).map((pin) => new URL(pin.url).hostname));
  if (hosts.size !== 1) {
    console.error(`expected one registry host in the lock file, found ${[...hosts].join(", ")}`);
    process.exit(1);
  }
  console.log([...hosts][0]);
' "$lock_file")"
echo "$registry_host"

if (cd "$scratch" && node -e '
  const { createRequire } = require("node:module");
  createRequire(require.resolve(process.argv[1] + "/package.json")).resolve("prettier");
' "$package" 2>/dev/null); then
  fail "prettier is resolvable from $scratch; the default rex new path must not need it"
fi

offline="$work/offline-registry.mjs"
cat >"$offline" <<'OFFLINE'
const blocked = process.env.REX_SMOKE_BLOCKED_HOST;
const request = globalThis.fetch;
let hits = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === blocked) {
    hits += 1;
    throw new TypeError(`fetch failed: networking to ${blocked} is disabled`);
  }
  return request(input, init);
};
process.on("exit", () => {
  if (hits > 0) process.stderr.write(`smoke-package: blocked ${hits} requests to ${blocked}\n`);
});
OFFLINE

step "rex new $designx_app_name --no-install with networking to $registry_host disabled"
(cd "$scratch" && REX_SMOKE_BLOCKED_HOST="$registry_host" NODE_OPTIONS="--import=$offline" \
  pnpm exec rex new "$designx_app_name" --no-install) 2>"$work/designx-new.log" ||
  { cat "$work/designx-new.log" >&2; fail "rex new $designx_app_name failed with $registry_host unreachable"; }
cat "$work/designx-new.log" >&2
grep -q "blocked [1-9][0-9]* requests to $registry_host" "$work/designx-new.log" ||
  fail "rex new $designx_app_name did not try $registry_host"
designx_app="$scratch/$designx_app_name"
for file in dx.json app/theme.css app/components/ui/button.tsx app/components/Shell.tsx; do
  [ -f "$designx_app/$file" ] || fail "rex new did not write $designx_app_name/$file"
done
node -e '
  const manifest = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const loose = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(([, version]) => !/^\^?\d+\.\d+(\.\d+)?$/.test(version));
  if (loose.length > 0) {
    console.error(`unpinned dependencies: ${loose.map(([name, version]) => `${name}@${version}`).join(", ")}`);
    process.exit(1);
  }
' "$designx_app/package.json"

step "pointing $designx_app_name at $tarball"
point_at_tarball "$designx_app"
(cd "$designx_app" && pnpm install)

step "formatting $designx_app_name with its own prettier"
(cd "$designx_app" && pnpm run format)

step "rex check $designx_app_name"
(cd "$designx_app" && pnpm exec rex check)

step "rex new $app_name --ui none --no-install"
(cd "$scratch" && pnpm exec rex new "$app_name" --ui none --no-install)
app="$scratch/$app_name"
[ -f "$app/package.json" ] || fail "rex new did not write $app_name/package.json"

step "pointing $app_name at $tarball"
point_at_tarball "$app"
(cd "$app" && pnpm install)

step "rex check"
(cd "$app" && pnpm exec rex check)

step "rex build"
(cd "$app" && pnpm exec rex build)
[ -f "$app/dist/server.js" ] || fail "rex build did not write dist/server.js"

step "starting node dist/server.js on a free port"
server_log="$work/server.log"
(cd "$app" && PORT=0 HOST=127.0.0.1 exec node dist/server.js) >"$server_log" 2>&1 &
server_pid=$!
url=""
attempt=0
while [ -z "$url" ]; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    cat "$server_log" >&2
    fail "node dist/server.js exited before serving"
  fi
  url="$(sed -n 's/^rex: serving //p' "$server_log" | head -n 1)"
  [ -n "$url" ] && break
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$start_attempts" ]; then
    cat "$server_log" >&2
    fail "node dist/server.js did not report its URL within $start_attempts seconds"
  fi
  sleep 1
done
case "$url" in
  http://127.0.0.1:*) ;;
  *) fail "unexpected server URL: $url" ;;
esac
step "serving at $url"

expect_200() {
  response_path="$1"
  response_file="$2"
  shift 2
  response_status="$(curl -sS -o "$response_file" -w '%{http_code}' "$@" "$url$response_path")" ||
    fail "request to $response_path failed"
  [ "$response_status" = "200" ] || fail "$response_path answered $response_status, expected 200"
}

step "GET /"
expect_200 / "$work/home.html" -H "accept: text/html"
grep -q "data-rex-page=\"home\"" "$work/home.html" || fail "the home page has no data-rex-page=\"home\""
grep -q "type=\"application/rex+json\"" "$work/home.html" || fail "the home page has no sidecar script"
grep -q "id=\"rex-page\"" "$work/home.html" || fail "the home page sidecar script has no id rex-page"

step "GET /rex/manifest"
expect_200 /rex/manifest "$work/manifest.json"
node -e '
  const manifest = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const pages = Array.isArray(manifest.pages) ? manifest.pages.map((page) => page.id) : [];
  if (!pages.includes("home")) {
    console.error(`the manifest lists pages ${JSON.stringify(pages)}, expected home`);
    process.exit(1);
  }
' "$work/manifest.json"

step "POST /rex/rpc/ping"
expect_200 /rex/rpc/ping "$work/ping.json" -X POST \
  -H "content-type: application/json" -H "origin: $url" --data '{"json":{}}'
node -e '
  const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  if (body?.json?.ok !== true) {
    console.error(`ping answered ${JSON.stringify(body)}, expected { json: { ok: true } }`);
    process.exit(1);
  }
' "$work/ping.json"

step "stopping the server"
kill "$server_pid"
wait "$server_pid" 2>/dev/null || true
server_pid=""

step "ok $tarball"

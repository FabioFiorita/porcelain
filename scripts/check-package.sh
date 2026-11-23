#!/usr/bin/env bash
set -euo pipefail
: "${VERSION:?Set VERSION to the release version}"
package_directory="$PWD/dist-porcelain"
tarball_directory="${PACKAGE_TARBALL_DIRECTORY:-$(mktemp -d)}"
prefix=$(mktemp -d)
server_pid=
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$prefix"
  if [[ -z "${PACKAGE_TARBALL_DIRECTORY:-}" ]]; then rm -rf "$tarball_directory"; fi
}
trap cleanup EXIT
mkdir -p "$tarball_directory"
export npm_config_cache="$prefix/cache"
(cd "$package_directory" && npm pack --json --pack-destination "$tarball_directory") > "$prefix/pack.json"
tarball=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].filename' "$prefix/pack.json")
npm install --strict-peer-deps --no-audit --no-fund --package-lock=false --prefix "$prefix/install" "$tarball_directory/$tarball"
cd "$prefix"
export PORCELAIN_DATA_DIRECTORY="$prefix/data"
export PORCELAIN_PROJECT_HOME="$prefix/projects"
porcelain="$prefix/install/node_modules/.bin/porcelain"
output=$("$porcelain" --version)
printf '%s\n' "$output"
test "$output" = "porcelain v$VERSION"
mkdir "$prefix/home" "$PORCELAIN_PROJECT_HOME"
HOME="$prefix/home" "$porcelain" serve --host=127.0.0.1 --port=0 > "$prefix/server.log" 2>&1 &
server_pid=$!
address=
for ((attempt=0; attempt<120; attempt++)); do
  address=$(sed -n 's/^Porcelain listening at \(http:\/\/127\.0\.0\.1:[0-9][0-9]*\)$/\1/p' "$prefix/server.log")
  [[ -n "$address" ]] && break
  kill -0 "$server_pid" 2>/dev/null || break
  sleep 0.25
done
if [[ -z "$address" ]] || ! curl --fail --silent --show-error --max-time 5 "$address/api/health" |
  jq -e '.status == "ok" and (.environmentId | type == "string" and length > 0)' > /dev/null; then
  cat "$prefix/server.log" >&2
  echo "The packed Porcelain server did not return a healthy HTTP response." >&2
  exit 1
fi
echo "The packed Porcelain server returned a healthy HTTP response."
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'tarball=%s/%s\n' "$tarball_directory" "$tarball" >> "$GITHUB_OUTPUT"
fi

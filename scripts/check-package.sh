#!/usr/bin/env bash
set -euo pipefail
: "${VERSION:?Set VERSION to the release version}"
package_directory="$PWD/dist-porcelain"
tarball_directory="${PACKAGE_TARBALL_DIRECTORY:-$(mktemp -d)}"
prefix=$(mktemp -d)
cleanup() {
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
output=$("$prefix/install/node_modules/.bin/porcelain" --version)
printf '%s\n' "$output"
test "$output" = "porcelain v$VERSION"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'tarball=%s/%s\n' "$tarball_directory" "$tarball" >> "$GITHUB_OUTPUT"
fi

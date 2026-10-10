#!/usr/bin/env bash
set -euo pipefail
: "${VERSION:?Set VERSION to the release version}"
package_directory="$PWD/dist-porcelain"
prefix=$(mktemp -d)
trap 'rm -rf "$prefix"' EXIT
export npm_config_cache="$prefix/cache"
(cd "$package_directory" && npm pack --json --pack-destination "$prefix") > "$prefix/pack.json"
tarball=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].filename' "$prefix/pack.json")
npm install --strict-peer-deps --no-audit --no-fund --package-lock=false --prefix "$prefix/install" "$prefix/$tarball"
cd "$prefix"
export PORCELAIN_DATA_DIRECTORY="$prefix/data"
export PORCELAIN_PROJECT_HOME="$prefix/projects"
output=$("$prefix/install/node_modules/.bin/porcelain" --version)
printf '%s\n' "$output"
test "$output" = "porcelain v$VERSION"

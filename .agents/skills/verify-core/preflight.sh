# Sourced by every verify CLI shim, so $0 is the shim four folders below the checkout root.
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node is missing; install the Node version declared in $root/package.json" >&2
  exit 1
fi
if [ ! -d "$root/node_modules" ]; then
  echo "This checkout has no dependencies installed; run pnpm install in $root" >&2
  exit 1
fi

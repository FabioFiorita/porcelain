#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_DIR="${MODULE_DIR}/Vendor/libghostty"

GHOSTTY_IOS_REVISION="${GHOSTTY_IOS_REVISION:-d36c3b8dffd0d756dd5e5f4933962f774a0e6753}"
GHOSTTY_SOURCE_DIR="${GHOSTTY_SOURCE_DIR:-${HOME}/.cache/porcelain/ghostty-custom-io-${GHOSTTY_IOS_REVISION:0:8}}"
GHOSTTY_SOURCE_REPOSITORY="${GHOSTTY_SOURCE_REPOSITORY:-https://github.com/Yash-Singh1/ghostty.git}"
GHOSTTY_ZIG_VERSION="${GHOSTTY_ZIG_VERSION:-0.15.2}"
GHOSTTY_ZIG="${GHOSTTY_ZIG:-}"
# Official Zig release signing key, published at https://ziglang.org/download/.
ZIG_MINISIGN_PUBLIC_KEY="RWSGOq2NVecA2UPNdBUZykf1CCb147pkmdtYxgb3Ti+JO/wCYvhbAb/U"

log() {
  printf '[libghostty-ios16] %s\n' "$*"
}

die() {
  printf '[libghostty-ios16] error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

ensure_zig() {
  if [[ -n "${GHOSTTY_ZIG}" ]]; then
    [[ -x "${GHOSTTY_ZIG}" ]] || die "GHOSTTY_ZIG is not executable: ${GHOSTTY_ZIG}"
    return
  fi

  if command -v zig >/dev/null 2>&1 && [[ "$(zig version)" == "${GHOSTTY_ZIG_VERSION}" ]]; then
    GHOSTTY_ZIG="$(command -v zig)"
    return
  fi

  local cache_dir="${HOME}/.cache/porcelain/zig-${GHOSTTY_ZIG_VERSION}"
  local archive_arch
  archive_arch="$(uname -m)"
  case "${archive_arch}" in
    arm64) archive_arch="aarch64" ;;
    x86_64) archive_arch="x86_64" ;;
    *) die "unsupported macOS architecture for Zig download: ${archive_arch}" ;;
  esac

  GHOSTTY_ZIG="${cache_dir}/zig"
  if [[ -x "${GHOSTTY_ZIG}" ]]; then
    return
  fi

  require_cmd curl
  require_cmd minisign
  require_cmd tar
  mkdir -p "${cache_dir}"
  log "downloading Zig ${GHOSTTY_ZIG_VERSION}"
  local archive signature
  archive="$(mktemp)"
  signature="${archive}.minisig"
  curl -fsSL -o "${archive}" \
    "https://ziglang.org/download/${GHOSTTY_ZIG_VERSION}/zig-${archive_arch}-macos-${GHOSTTY_ZIG_VERSION}.tar.xz"
  curl -fsSL -o "${signature}" \
    "https://ziglang.org/download/${GHOSTTY_ZIG_VERSION}/zig-${archive_arch}-macos-${GHOSTTY_ZIG_VERSION}.tar.xz.minisig"
  minisign -Vm "${archive}" -P "${ZIG_MINISIGN_PUBLIC_KEY}"
  tar -xJf "${archive}" --strip-components=1 -C "${cache_dir}"
  rm -f "${archive}" "${signature}"
}

require_cmd git
require_cmd xcodebuild
require_cmd xcrun
require_cmd rsync
ensure_zig

ensure_ghostty_source() {
  if [[ ! -d "${GHOSTTY_SOURCE_DIR}/.git" ]]; then
    log "cloning Ghostty custom-I/O fork ${GHOSTTY_IOS_REVISION}"
    mkdir -p "$(dirname "${GHOSTTY_SOURCE_DIR}")"
    git clone --filter=blob:none --no-checkout "${GHOSTTY_SOURCE_REPOSITORY}" \
      "${GHOSTTY_SOURCE_DIR}"
  fi

  git -C "${GHOSTTY_SOURCE_DIR}" fetch --depth=1 origin "${GHOSTTY_IOS_REVISION}"
  git -C "${GHOSTTY_SOURCE_DIR}" checkout --detach "${GHOSTTY_IOS_REVISION}"
  local actual_revision
  actual_revision="$(git -C "${GHOSTTY_SOURCE_DIR}" rev-parse HEAD)"
  [[ "${actual_revision}" == "${GHOSTTY_IOS_REVISION}" ]] || \
    die "expected Ghostty custom-I/O ${GHOSTTY_IOS_REVISION}, found ${actual_revision}"
}

ensure_ghostty_source

ghostty_ref="$(git -C "${GHOSTTY_SOURCE_DIR}" rev-parse HEAD)"
log "using Ghostty source: ${GHOSTTY_SOURCE_DIR} @ ${ghostty_ref}"
log "using Zig: ${GHOSTTY_ZIG} ($("${GHOSTTY_ZIG}" version))"
log "building GhosttyKit.xcframework"

(
  cd "${GHOSTTY_SOURCE_DIR}"
  PATH="$(dirname "${GHOSTTY_ZIG}"):${PATH}" "${GHOSTTY_ZIG}" build \
    -Dapp-runtime=none \
    -Demit-xcframework=true \
    -Demit-macos-app=false \
    -Demit-exe=false \
    -Demit-docs=false \
    -Demit-webdata=false \
    -Demit-helpgen=false \
    -Demit-terminfo=false \
    -Demit-termcap=false \
    -Demit-themes=false \
    -Doptimize=ReleaseFast \
    -Dstrip \
    -Dxcframework-target=universal
)

xcframework="${GHOSTTY_SOURCE_DIR}/macos/GhosttyKit.xcframework"
ios_archive="${xcframework}/ios-arm64/libghostty-fat.a"
sim_archive="${xcframework}/ios-arm64-simulator/libghostty-fat.a"
[[ -f "${ios_archive}" ]] || die "missing built iOS archive: ${ios_archive}"
[[ -f "${sim_archive}" ]] || die "missing built iOS simulator archive: ${sim_archive}"

log "stripping iOS archives"
xcrun strip -S -x "${ios_archive}"
xcrun strip -S -x "${sim_archive}"

log "copying iOS archives into ${VENDOR_DIR}/GhosttyKit.xcframework"
cp "${ios_archive}" "${VENDOR_DIR}/GhosttyKit.xcframework/ios-arm64/libghostty-fat.a"
cp "${sim_archive}" "${VENDOR_DIR}/GhosttyKit.xcframework/ios-arm64-simulator/libghostty-fat.a"
rsync -a --delete "${xcframework}/ios-arm64/Headers/" \
  "${VENDOR_DIR}/GhosttyKit.xcframework/ios-arm64/Headers/"
rsync -a --delete "${xcframework}/ios-arm64-simulator/Headers/" \
  "${VENDOR_DIR}/GhosttyKit.xcframework/ios-arm64-simulator/Headers/"

log "done"

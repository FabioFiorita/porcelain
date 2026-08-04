#!/usr/bin/env bash
# Deterministic Android emulator control loop for apps/mobile.
#
# The loop prefers exact React Native testIDs exposed as Android resource IDs,
# then exact accessibility labels/text, and only uses coordinates derived from
# the current uiautomator tree. It never chooses coordinates by reading a
# screenshot.
#
# Usage: android-loop.sh <command> [args]
#   preflight                   report package, emulator, Metro, and foreground app
#   up                          reuse or boot an emulator, reverse Metro, launch dev client
#   ui [filter]                 list visible IDs, labels, bounds, and actions
#   tap <testID-or-label>       tap one unambiguous semantic target
#   wait <testID-or-label> [s]  wait for one semantic target to appear
#   xy <x> <y>                  explicit coordinate fallback (last resort)
#   swipe <x1> <y1> <x2> <y2> [ms]
#   text <string>               type into the focused field
#   key <BACK|HOME|ENTER>       send a hardware key
#   shot <path>                 capture a screenshot (then inspect it)
#   fg                          print the foreground activity
#   logs [pattern]              stream this app's logcat
#   down                        remove this loop's reverse and stop only its emulator
#
# Machine-specific inputs:
#   APP_VARIANT=development|production (default: development)
#   METRO_PORT=8081
#   ANDROID_LOOP_AVD=<name>
#   ANDROID_LOOP_SERIAL=<serial>
#   ANDROID_LOOP_WINDOW=1         show the emulator window instead of headless mode
#   ANDROID_LOOP_EMULATOR_ARGS='...'
#   ANDROID_LOOP_STATE_DIR=<temp directory for ownership state>
#   ADB_BIN=<adb path>, EMULATOR_BIN=<emulator path>
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SCRIPT_DIR/../../../.." rev-parse --show-toplevel)"
MOBILE="$REPO/apps/mobile"

APP_VARIANT="${APP_VARIANT:-development}"
METRO_PORT="${METRO_PORT:-8081}"
STATE_DIR="${ANDROID_LOOP_STATE_DIR:-${TMPDIR:-/tmp}/porcelain-android-loop-${UID:-$(id -u)}}"
STATE_FILE="$STATE_DIR/state"
EMULATOR_LOG="$STATE_DIR/emulator.log"

ADB_BIN="${ADB_BIN:-}"
EMULATOR_BIN="${EMULATOR_BIN:-}"
PACKAGE=""
SCHEME=""

die() {
  echo "error: $*" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

resolve_tools() {
  [[ -n "$ADB_BIN" ]] || ADB_BIN="$(command -v adb || true)"
  [[ -n "$EMULATOR_BIN" ]] || EMULATOR_BIN="$(command -v emulator || true)"
  [[ -n "$ADB_BIN" ]] || die "adb is not on PATH; install Android SDK platform-tools or set ADB_BIN"
  [[ -n "$EMULATOR_BIN" ]] || die "emulator is not on PATH; install the Android emulator or set EMULATOR_BIN"
  have python3 || die "python3 is required to parse the Android accessibility tree"
}

resolve_config() {
  local config
  config="$(cd "$MOBILE" && APP_VARIANT="$APP_VARIANT" pnpm exec expo config --type public --json 2>/dev/null)" \
    || die "could not resolve Expo config for APP_VARIANT=$APP_VARIANT"

  PACKAGE="$(node -e 'const fs = require("node:fs"); const c = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(c.android?.package ?? "")' <<<"$config")"
  SCHEME="$(node -e 'const fs = require("node:fs"); const c = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(c.scheme ?? "")' <<<"$config")"
  [[ -n "$PACKAGE" ]] || die "Expo config has no Android package for APP_VARIANT=$APP_VARIANT"
  [[ -n "$SCHEME" ]] || die "Expo config has no URL scheme for APP_VARIANT=$APP_VARIANT"
}

adb_cmd() {
  "$ADB_BIN" "$@"
}

state_get() {
  [[ -f "$STATE_FILE" ]] || return 1
  sed -n "s/^$1=//p" "$STATE_FILE" | head -n 1
}

state_write() {
  local serial="$1"
  local owned="$2"
  mkdir -p "$STATE_DIR"
  printf 'serial=%s\nowned=%s\nreverse=1\npackage=%s\n' "$serial" "$owned" "$PACKAGE" >"$STATE_FILE"
}

running_serials() {
  adb_cmd devices | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1 }'
}

is_running_serial() {
  local wanted="$1"
  running_serials | grep -Fxq -- "$wanted"
}

select_serial() {
  local explicit="${ANDROID_LOOP_SERIAL:-}"
  local saved="$(state_get serial || true)"
  local serials=()
  mapfile -t serials < <(running_serials)

  if [[ -n "$explicit" ]]; then
    is_running_serial "$explicit" || die "ANDROID_LOOP_SERIAL '$explicit' is not a ready emulator"
    printf '%s\n' "$explicit"
    return
  fi

  if [[ -n "$saved" ]] && is_running_serial "$saved"; then
    printf '%s\n' "$saved"
    return
  fi

  case "${#serials[@]}" in
    0) die "no ready Android emulator; run: $0 up" ;;
    1) printf '%s\n' "${serials[0]}" ;;
    *) die "multiple emulators are ready (${serials[*]}); set ANDROID_LOOP_SERIAL" ;;
  esac
}

wait_for_boot() {
  local serial="$1"
  adb_cmd -s "$serial" wait-for-device >/dev/null
  local attempt
  for attempt in $(seq 1 90); do
    if [[ "$(adb_cmd -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      return 0
    fi
    sleep 2
  done
  die "emulator $serial did not finish booting within 180 seconds"
}

boot_emulator() {
  local avd="${ANDROID_LOOP_AVD:-}"
  [[ -n "$avd" ]] || avd="$($EMULATOR_BIN -list-avds 2>/dev/null | grep -v '^INFO' | head -n 1 || true)"
  [[ -n "$avd" ]] || die "no Android AVD found; set ANDROID_LOOP_AVD or create one"

  if pgrep -fa "emulator.*-avd[ =]$avd([[:space:]]|$)" >/dev/null 2>&1; then
    die "an emulator process for AVD '$avd' already exists but adb does not show it; resolve that before booting another"
  fi

  local args=(-avd "$avd" -no-boot-anim -no-snapshot-save)
  if [[ "${ANDROID_LOOP_WINDOW:-}" != "1" ]]; then
    args+=(-no-window -no-audio -gpu swiftshader_indirect)
  fi
  if [[ -n "${ANDROID_LOOP_EMULATOR_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    args+=( ${ANDROID_LOOP_EMULATOR_ARGS} )
  fi

  mkdir -p "$STATE_DIR"
  echo "booting AVD '$avd'..." >&2
  nohup "$EMULATOR_BIN" "${args[@]}" >"$EMULATOR_LOG" 2>&1 < /dev/null &

  local attempt
  for attempt in $(seq 1 90); do
    local serials=()
    mapfile -t serials < <(running_serials)
    if [[ "${#serials[@]}" -eq 1 ]]; then
      wait_for_boot "${serials[0]}"
      printf '%s\n' "${serials[0]}"
      return
    fi
    sleep 2
  done
  die "AVD '$avd' did not appear in adb within 180 seconds; inspect $EMULATOR_LOG"
}

dump_xml() {
  local serial="$1"
  local remote_path="/sdcard/porcelain-ui-${BASHPID}.xml"
  adb_cmd -s "$serial" shell uiautomator dump "$remote_path" >/dev/null 2>&1 || return 1
  adb_cmd -s "$serial" shell cat "$remote_path"
}

parse_elements() {
  python3 -c '
import html
import re
import sys
import xml.etree.ElementTree as ET

raw = sys.stdin.read()
try:
    root = ET.fromstring(raw)
except ET.ParseError:
    raise SystemExit("could not parse uiautomator XML")

for node in root.iter("node"):
    attrs = node.attrib
    resource_id = attrs.get("resource-id", "")
    test_id = resource_id.rsplit("/", 1)[-1] if resource_id else ""
    text = html.unescape(attrs.get("text", ""))
    description = html.unescape(attrs.get("content-desc", ""))
    label = description or text
    bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", attrs.get("bounds", ""))
    if not bounds or (not test_id and not label):
        continue
    x1, y1, x2, y2 = map(int, bounds.groups())
    if x2 <= x1 or y2 <= y1:
        continue
    clean = lambda value: re.sub(r"[\t\r\n]+", " ", value).strip()
    print("\t".join([
        str((x1 + x2) // 2),
        str((y1 + y2) // 2),
        clean(test_id),
        clean(label),
        clean(attrs.get("class", "")),
        attrs.get("clickable", "false"),
        attrs.get("selected", "false"),
        attrs.get("enabled", "true"),
    ]))
'
}

ui_rows() {
  local serial="$1"
  dump_xml "$serial" | parse_elements
}

select_row() {
  local selector="$1"
  local clickable_only="${2:-true}"
  local allow_ambiguous="${3:-false}"
  python3 -c '
import sys

query = sys.argv[1].casefold()
clickable_only = sys.argv[2] == "true"
allow_ambiguous = sys.argv[3] == "true"
rows = [line.rstrip("\n").split("\t") for line in sys.stdin if line.strip()]
if clickable_only:
    rows = [row for row in rows if len(row) > 5 and row[5] == "true"]

def exact(field):
    return [row for row in rows if len(row) > field and row[field].casefold() == query]

matches = exact(2) or exact(3)
if not matches:
    matches = [row for row in rows if any(query in row[field].casefold() for field in (2, 3) if len(row) > field)]

if len(matches) > 1 and not allow_ambiguous:
    print(f"ambiguous selector {sys.argv[1]!r}; matches:", file=sys.stderr)
    for row in matches:
        print("  " + " | ".join(row[2:5]), file=sys.stderr)
    raise SystemExit(2)
if not matches:
    raise SystemExit(1)
print("\t".join(matches[0]))
' "$selector" "$clickable_only" "$allow_ambiguous"
}

tap_row() {
  local serial="$1"
  local row="$2"
  local x y
  IFS=$'\t' read -r x y _ <<<"$row"
  adb_cmd -s "$serial" shell input tap "$x" "$y"
}

dismiss_dev_menu() {
  local serial="$1"
  local attempt
  for attempt in $(seq 1 20); do
    local rows
    rows="$(ui_rows "$serial" 2>/dev/null || true)"
    local continue_row=""
    continue_row="$(select_row Continue false <<<"$rows" 2>/dev/null || true)"
    if [[ -n "$continue_row" ]]; then
      tap_row "$serial" "$continue_row"
      sleep 1
      adb_cmd -s "$serial" shell input keyevent KEYCODE_BACK
      sleep 1
      continue
    fi
    [[ -n "$rows" ]] && return 0
    sleep 1
  done
  echo "warning: no readable app hierarchy appeared within 20 seconds" >&2
}

metro_ready() {
  have curl && curl -fsS -o /dev/null "http://127.0.0.1:$METRO_PORT/status"
}

cmd_preflight() {
  resolve_tools
  resolve_config
  echo "package        : $PACKAGE"
  echo "scheme         : $SCHEME"
  echo "variant        : $APP_VARIANT"
  echo "metro          : $METRO_PORT $(metro_ready && echo ready || echo DOWN)"
  local serials=()
  mapfile -t serials < <(running_serials)
  if [[ "${#serials[@]}" -eq 0 ]]; then
    echo "emulator       : NOT RUNNING (run: $0 up)"
    return 0
  fi
  printf 'emulator       : %s\n' "${serials[*]}"
  local serial="${serials[0]}"
  adb_cmd -s "$serial" shell pm path "$PACKAGE" >/dev/null 2>&1 \
    && echo "dev client     : installed" \
    || echo "dev client     : NOT INSTALLED (run: APP_VARIANT=$APP_VARIANT pnpm --dir apps/mobile android:build)"
  echo "android        : $(adb_cmd -s "$serial" shell getprop ro.build.version.release | tr -d '\r') / API $(adb_cmd -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')"
  cmd_fg "$serial"
}

cmd_up() {
  resolve_tools
  resolve_config
  metro_ready || die "Metro is not answering on port $METRO_PORT; start it before running $0 up"

  local serial
  local owned=0
  local serials=()
  mapfile -t serials < <(running_serials)
  if [[ "${#serials[@]}" -eq 0 ]]; then
    serial="$(boot_emulator)"
    owned=1
  else
    serial="$(select_serial)"
    wait_for_boot "$serial"
  fi

  adb_cmd -s "$serial" reverse "tcp:$METRO_PORT" "tcp:$METRO_PORT" >/dev/null
  local url="${SCHEME}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${METRO_PORT}"
  adb_cmd -s "$serial" shell am start -W -a android.intent.action.VIEW -d "$url" "$PACKAGE" >/dev/null
  state_write "$serial" "$owned"
  dismiss_dev_menu "$serial"
  echo "launched $PACKAGE against Metro:$METRO_PORT on $serial (owned=$owned)"
}

cmd_ui() {
  resolve_tools
  local serial
  serial="$(select_serial)"
  local rows
  rows="$(ui_rows "$serial")"
  if [[ -n "${1:-}" ]]; then
    rows="$(grep -Fai -- "$1" <<<"$rows" || true)"
  fi
  [[ -n "$rows" ]] || die "no visible elements matched '${1:-the current screen}'"
  awk -F '\t' '{printf "%-6s %-6s %-34s %-34s %s\n", $1, $2, $3, $4, $6}' <<<"$rows"
}

cmd_tap() {
  [[ -n "${1:-}" ]] || die "tap needs a testID or accessibility label"
  resolve_tools
  local serial
  serial="$(select_serial)"
  local rows row
  rows="$(ui_rows "$serial")"
  row="$(select_row "$1" true <<<"$rows")" \
    || die "no unique clickable element matched '$1'; run: $0 ui"
  tap_row "$serial" "$row"
  IFS=$'\t' read -r _ _ test_id label _ <<<"$row"
  echo "tapped ${test_id:-$label}"
}

cmd_wait() {
  [[ -n "${1:-}" ]] || die "wait needs a testID or accessibility label"
  local timeout="${2:-20}"
  resolve_tools
  local serial
  serial="$(select_serial)"
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if ui_rows "$serial" 2>/dev/null | select_row "$1" false true >/dev/null; then
      echo "found $1"
      return 0
    fi
    sleep 1
  done
  die "timed out waiting for '$1' after ${timeout}s"
}

cmd_xy() {
  [[ $# -eq 2 ]] || die "xy needs x y"
  resolve_tools
  local serial
  serial="$(select_serial)"
  adb_cmd -s "$serial" shell input tap "$1" "$2"
}

cmd_swipe() {
  [[ $# -ge 4 ]] || die "swipe needs x1 y1 x2 y2 [duration-ms]"
  resolve_tools
  local serial
  serial="$(select_serial)"
  adb_cmd -s "$serial" shell input swipe "$1" "$2" "$3" "$4" "${5:-300}"
}

cmd_text() {
  [[ -n "${1:-}" ]] || die "text needs a string"
  resolve_tools
  local serial
  serial="$(select_serial)"
  local value="${1// /%s}"
  adb_cmd -s "$serial" shell input text "$(printf '%q' "$value")"
}

cmd_key() {
  [[ -n "${1:-}" ]] || die "key needs BACK, HOME, or ENTER"
  resolve_tools
  local serial
  serial="$(select_serial)"
  adb_cmd -s "$serial" shell input keyevent "KEYCODE_${1^^}"
}

cmd_shot() {
  [[ -n "${1:-}" ]] || die "shot needs an output path"
  resolve_tools
  local serial
  serial="$(select_serial)"
  mkdir -p "$(dirname -- "$1")"
  adb_cmd -s "$serial" exec-out screencap -p >"$1"
  echo "$1"
}

cmd_fg() {
  resolve_tools
  local serial="${1:-}"
  [[ -n "$serial" ]] || serial="$(select_serial)"
  adb_cmd -s "$serial" shell dumpsys activity activities \
    | grep -m 1 -E 'mResumedActivity|mFocusedApp|topResumedActivity' || true
}

cmd_logs() {
  resolve_tools
  resolve_config
  local serial
  serial="$(select_serial)"
  local pid
  pid="$(adb_cmd -s "$serial" shell pidof "$PACKAGE" | tr -d '\r' | awk '{print $1}')"
  [[ -n "$pid" ]] || die "$PACKAGE is not running"
  if [[ -n "${1:-}" ]]; then
    adb_cmd -s "$serial" logcat --pid="$pid" | grep --line-buffered -E -- "$1"
  else
    adb_cmd -s "$serial" logcat --pid="$pid"
  fi
}

cmd_down() {
  resolve_tools
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "no emulator ownership state; leaving all emulators running"
    return 0
  fi
  local serial="$(state_get serial || true)"
  local owned="$(state_get owned || true)"
  local reverse="$(state_get reverse || true)"
  if [[ -n "$serial" ]] && is_running_serial "$serial"; then
    if [[ "$reverse" == "1" ]]; then
      adb_cmd -s "$serial" reverse --remove "tcp:$METRO_PORT" >/dev/null 2>&1 || true
    fi
    if [[ "$owned" == "1" ]]; then
      adb_cmd -s "$serial" emu kill >/dev/null 2>&1 || true
      echo "stopped emulator $serial"
    else
      echo "left pre-existing emulator $serial running"
    fi
  fi
  rm -f "$STATE_FILE"
}

case "${1:-}" in
  preflight) shift; cmd_preflight "$@" ;;
  up)        shift; cmd_up "$@" ;;
  ui)        shift; cmd_ui "${1:-}" ;;
  tap)       shift; cmd_tap "$@" ;;
  wait)      shift; cmd_wait "$@" ;;
  xy)        shift; cmd_xy "$@" ;;
  swipe)     shift; cmd_swipe "$@" ;;
  text)      shift; cmd_text "$@" ;;
  key)       shift; cmd_key "$@" ;;
  shot)      shift; cmd_shot "$@" ;;
  fg)        shift; cmd_fg "$@" ;;
  logs)      shift; cmd_logs "${1:-}" ;;
  down)      shift; cmd_down "$@" ;;
  *)
    sed -n '2,34p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

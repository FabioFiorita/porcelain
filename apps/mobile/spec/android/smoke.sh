#!/usr/bin/env bash
set -euo pipefail

serial=${ANDROID_SERIAL:?Use the Android emulator runner}
evidence=${RUNNER_TEMP:?}/android-smoke
cli=.agents/skills/mobile-verify/scripts/cli
flows=apps/mobile/spec/android
instance=
paired=false
mkdir -p "$evidence"

finish() {
  local result=$?
  if [[ -n "$instance" ]]; then
    if [[ "$paired" == true && "$result" != 0 ]]; then
      "${device[@]}" snapshot -i > "$evidence/failure.txt" 2>&1 || true
      "${device[@]}" screenshot "$evidence/failure.png" || true
    fi
    if [[ "$result" != 0 ]]; then
      local report
      if report=$("$cli" logs --instance "$instance"); then
        cp "${report#recorded }" "$evidence/runtime.txt" || true
      fi
    fi
    "$cli" stop --instance "$instance" || result=1
  fi
  exit "$result"
}
trap finish EXIT

"$cli" doctor --device android --serial "$serial"
card=$("$cli" start --device android --serial "$serial" --fixture focused --manual-pairing)
instance=$(sed -n 's/^instance //p' <<< "$card")
connection=$(sed -n 's/^connection //p' <<< "$card")
mapfile -t device < <(jq -r '.mobile.agentDevice | .launcher, .targetArgs[]' "$connection")
adb -s "$serial" shell dumpsys SurfaceFlinger | grep '^GLES:' > "$evidence/renderer.txt"

echo 'Pair with the fixture server'
"${device[@]}" snapshot -i > "$evidence/before-pairing.txt"
"${device[@]}" screenshot "$evidence/before-pairing.png"
if ! "${device[@]}" replay "$flows/pair-computer.ad" --json > "$RUNNER_TEMP/pair-computer.json" 2>&1; then
  jq -r 'select(.error) | "Pairing replay error \(.error.code) at step \(.error.details.step // "unknown")."' \
    "$RUNNER_TEMP/pair-computer.json" || true
  echo 'Pairing replay failed before the computer appeared online.' >&2
  exit 1
fi
"$cli" server devices --instance "$instance" |
  sed '/^recorded /d' |
  jq -e '[.[] | select(.label == "Development mobile" and .platform == "Android")] | length == 1'

paired=true
echo 'Open the changed README and mark it reviewed'
"${device[@]}" replay "$flows/review-file.ad"
"$cli" server reviewed-files --instance "$instance" |
  sed '/^recorded /d' |
  jq -e '.marks | map(.path) == ["README.md"] and all(.[]; .fingerprint != "")' > "$evidence/reviewed.txt"
"${device[@]}" screenshot "$evidence/reviewed.png"

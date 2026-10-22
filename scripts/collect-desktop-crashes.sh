set -euo pipefail

reports="$1"
started="$2"
destination="$3"
mkdir -p "$destination"
if [[ ! -f "$started" || ! -d "$reports" ]]; then
  exit 0
fi
for report in "$reports"/*; do
  [[ -f "$report" && ! -L "$report" && "$report" -nt "$started" ]] || continue
  case "$report" in
    *.ips|*.crash) ;;
    *) continue ;;
  esac
  process="${report##*/}"
  process="${process%%_*}"
  process="${process%%-[0-9][0-9][0-9][0-9]-*}"
  case "$process" in
    Electron|'Electron Helper'|'Electron Helper ('*')'|'Porcelain Dev'|'Porcelain Dev Helper'|'Porcelain Dev Helper ('*')')
      cp "$report" "$destination/"
      ;;
  esac
done

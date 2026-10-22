set -euo pipefail

reports="$1"
started="$2"
destination="$3"
mkdir -p "$destination"
if [[ ! -f "$started" || ! -d "$reports" ]]; then
  exit 0
fi
timestamped_report='^(.+)[_-][0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}([_-][A-Za-z0-9_.-]+)?\.(ips|crash)$'
for report in "$reports"/*; do
  [[ -f "$report" && ! -L "$report" && "$report" -nt "$started" ]] || continue
  filename="${report##*/}"
  [[ "$filename" =~ $timestamped_report ]] || continue
  process="${BASH_REMATCH[1]}"
  case "$process" in
    Electron|'Porcelain Dev'|'Electron Helper'|'Porcelain Dev Helper'|\
    'Electron Helper (Renderer)'|'Electron Helper (GPU)'|'Electron Helper (Plugin)'|\
    'Porcelain Dev Helper (Renderer)'|'Porcelain Dev Helper (GPU)'|'Porcelain Dev Helper (Plugin)')
      [[ "$(find "$report" -type f -links 1 -print)" == "$report" ]] || continue
      cp "$report" "$destination/"
      ;;
  esac
done

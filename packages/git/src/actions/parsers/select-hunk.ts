type HunkSelection =
  | { kind: 'selected'; patch: string }
  | { kind: 'partial' }
  | { kind: 'missing' };

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u;

export function selectHunk(
  diff: string,
  range: { startLine: number; endLine: number },
): HunkSelection {
  const lines = diff.split(/(?<=\n)/u);
  const firstHunk = lines.findIndex((line) => line.startsWith('@@ '));
  if (firstHunk < 0) return { kind: 'missing' };
  const header = lines
    .slice(0, firstHunk)
    .filter((line) => !line.startsWith('index '));
  let selected: string | undefined;
  for (let index = firstHunk; index < lines.length;) {
    const next = lines.findIndex(
      (line, candidate) => candidate > index && line.startsWith('@@ '),
    );
    const end = next < 0 ? lines.length : next;
    const match = HUNK_HEADER.exec(lines[index] ?? '');
    if (match) {
      const start = Number(match[1]);
      const last = start + Math.max(Number(match[2] ?? 1), 1) - 1;
      if (range.startLine <= last && range.endLine >= start) {
        if (
          range.startLine !== start ||
          range.endLine !== last ||
          selected !== undefined
        )
          return { kind: 'partial' };
        selected = [...header, ...lines.slice(index, end)].join('');
      }
    }
    index = end;
  }
  return selected === undefined
    ? { kind: 'missing' }
    : { kind: 'selected', patch: selected };
}

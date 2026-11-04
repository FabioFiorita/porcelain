const EXCERPT_CONTEXT = 3;

function trimHunk(
  hunk: readonly string[],
  range: { startLine: number; endLine: number },
): string[] {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(
    hunk[0] ?? '',
  );
  if (!match) return [];
  let oldLine = Number(match[1]) + (match[2] === '0' ? 1 : 0);
  let newLine = Number(match[3]) + (match[4] === '0' ? 1 : 0);
  const rows: {
    text: string;
    kind: string;
    oldLine: number;
    newLine: number;
    marker?: string;
  }[] = [];
  for (const text of hunk.slice(1)) {
    const kind = text[0];
    if (text === '\\ No newline at end of file') {
      const previous = rows.at(-1);
      if (previous) previous.marker = text;
      continue;
    }
    if (kind !== ' ' && kind !== '+' && kind !== '-') continue;
    const row = { text, kind, oldLine, newLine };
    if (kind !== '+') oldLine++;
    if (kind !== '-') newLine++;
    rows.push(row);
  }
  if (
    !rows.some(
      (row) => row.newLine >= range.startLine && row.newLine <= range.endLine,
    )
  )
    return [];
  const near = (line: number) =>
    line >= range.startLine - EXCERPT_CONTEXT &&
    line <= range.endLine + EXCERPT_CONTEXT;
  const first = rows.findIndex((row) => near(row.newLine));
  const last = rows.findLastIndex((row) => near(row.newLine));
  if (first < 0) return [];
  const slice = rows.slice(first, last + 1);
  const head = slice[0];
  if (!head) return [];
  const oldCount = slice.filter((row) => row.kind !== '+').length;
  const newCount = slice.filter((row) => row.kind !== '-').length;
  return [
    `@@ -${oldCount === 0 ? Math.max(head.oldLine - 1, 0) : head.oldLine},${oldCount} +${newCount === 0 ? Math.max(head.newLine - 1, 0) : head.newLine},${newCount} @@${match[5] ?? ''}`,
    ...slice.flatMap((row) =>
      row.marker ? [row.text, row.marker] : [row.text],
    ),
  ];
}

export function focusedPatch(
  patch: string,
  range: { startLine: number; endLine: number },
): string | undefined {
  const lines = patch.split('\n');
  const firstHunk = lines.findIndex((line) => line.startsWith('@@'));
  if (firstHunk < 0) return undefined;
  const header = lines.slice(0, firstHunk);
  const hunks: string[][] = [];
  for (const line of lines.slice(firstHunk)) {
    if (line.startsWith('@@')) hunks.push([line]);
    else hunks.at(-1)?.push(line);
  }
  const kept = hunks.flatMap((hunk) => trimHunk(hunk, range));
  if (kept.length === 0) return undefined;
  return [...header, ...kept, ''].join('\n');
}

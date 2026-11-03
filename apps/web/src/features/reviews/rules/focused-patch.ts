const EXCERPT_CONTEXT = 3;

function trimHunk(
  hunk: readonly string[],
  range: { startLine: number; endLine: number },
): string[] {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(hunk[0] ?? '');
  if (!match) return [];
  let oldLine = Number(match[1]);
  let newLine = Number(match[2]);
  const rows = hunk.slice(1).flatMap((text) => {
    const kind = text[0];
    if (kind !== ' ' && kind !== '+' && kind !== '-') return [];
    const row = { text, kind, oldLine, newLine };
    if (kind !== '+') oldLine++;
    if (kind !== '-') newLine++;
    return [row];
  });
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
    `@@ -${oldCount === 0 ? Math.max(head.oldLine - 1, 0) : head.oldLine},${oldCount} +${head.newLine},${newCount} @@${match[3] ?? ''}`,
    ...slice.map((row) => row.text),
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

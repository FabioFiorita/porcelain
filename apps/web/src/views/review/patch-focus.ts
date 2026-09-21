/**
 * Pure helpers over unified patch text, so a review can show only the part of a
 * file's diff a step (or an unexplained range) is about. Working on the text keeps
 * the real line numbers in the hunk headers, which is what comments anchor to.
 */

export type LineSpan = { startLine: number; endLine: number };

type PatchHunk = { oldStart: number; newStart: number; lines: string[] };

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function splitPatch(patch: string): { header: string[]; hunks: PatchHunk[] } {
  const header: string[] = [];
  const hunks: PatchHunk[] = [];
  for (const line of patch.split('\n')) {
    const match = HUNK_HEADER.exec(line);
    if (match != null) {
      hunks.push({
        oldStart: Number(match[1]),
        newStart: Number(match[2]),
        lines: [],
      });
    } else if (hunks.length === 0) {
      header.push(line);
    } else if (line !== '') {
      hunks.at(-1)?.lines.push(line);
    }
  }
  return { header, hunks };
}

/** Git writes a side with no lines as starting on the line before. */
const hunkHeader = (
  oldStart: number,
  oldCount: number,
  newStart: number,
  newCount: number,
) =>
  `@@ -${oldCount === 0 ? oldStart - 1 : oldStart},${oldCount} +${newCount === 0 ? newStart - 1 : newStart},${newCount} @@`;

type Walked = {
  text: string;
  oldLine: number;
  newLine: number;
  position: number;
};

/** Every hunk line with the old and new line it sits on; a deletion sits where it was. */
function walk(hunk: PatchHunk): Walked[] {
  let oldLine = hunk.oldStart === 0 ? 1 : hunk.oldStart;
  let newLine = hunk.newStart === 0 ? 1 : hunk.newStart;
  return hunk.lines.map((text) => {
    const entry = { text, oldLine, newLine, position: newLine };
    if (text.startsWith('+')) newLine += 1;
    else if (text.startsWith('-')) oldLine += 1;
    else if (!text.startsWith('\\')) {
      oldLine += 1;
      newLine += 1;
    }
    return entry;
  });
}

function joinRun(run: Walked[]): string[] {
  const first = run[0];
  if (first == null) return [];
  const oldCount = run.filter(
    (line) => line.text.startsWith(' ') || line.text.startsWith('-'),
  ).length;
  const newCount = run.filter(
    (line) => line.text.startsWith(' ') || line.text.startsWith('+'),
  ).length;
  return [
    hunkHeader(first.oldLine, oldCount, first.newLine, newCount),
    ...run.map((line) => line.text),
  ];
}

/**
 * The patch cut down to the lines near `spans` (new-side line numbers), with
 * `context` unchanged lines around them. Hunks that miss every span are dropped;
 * null when nothing is left. A patch with no hunks (a mode change) is returned as is.
 */
/** "Lines 12–18, 40" for a list of ranges. */
export function spansLabel(spans: readonly LineSpan[]): string {
  const parts = spans.map((span) =>
    span.startLine === span.endLine
      ? `${span.startLine}`
      : `${span.startLine}–${span.endLine}`,
  );
  return `${spans.length === 1 && spans[0]?.startLine === spans[0]?.endLine ? 'Line' : 'Lines'} ${parts.join(', ')}`;
}

export function focusPatch(
  patch: string,
  spans: readonly LineSpan[],
  context = 3,
): string | null {
  const { header, hunks } = splitPatch(patch);
  if (hunks.length === 0) return patch;
  const near = (position: number) =>
    spans.some(
      (span) =>
        position >= span.startLine - context &&
        position <= span.endLine + context,
    );
  const out: string[] = [...header];
  for (const hunk of hunks) {
    let run: Walked[] = [];
    for (const line of walk(hunk)) {
      // "\ No newline at end of file" belongs to the line before it.
      const keep = line.text.startsWith('\\')
        ? run.length > 0
        : near(line.position);
      if (keep) run.push(line);
      else if (run.length > 0) {
        out.push(...joinRun(run));
        run = [];
      }
    }
    if (run.length > 0) out.push(...joinRun(run));
  }
  return out.length === header.length ? null : `${out.join('\n')}\n`;
}

/**
 * Unchanged code shown with its real line numbers: a patch whose one hunk is all
 * context. Rendered unified, it reads as plain code numbered from `startLine`.
 */
export function contextPatch(
  path: string,
  startLine: number,
  lines: readonly string[],
): string {
  const body = lines.map((line) => ` ${line}`);
  return [
    `diff --git ${JSON.stringify(`a/${path}`)} ${JSON.stringify(`b/${path}`)}`,
    `--- ${JSON.stringify(`a/${path}`)}`,
    `+++ ${JSON.stringify(`b/${path}`)}`,
    `@@ -${startLine},${lines.length} +${startLine},${lines.length} @@`,
    ...body,
    '',
  ].join('\n');
}

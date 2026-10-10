import { parsePatch } from './patch.ts';

export type LineSpan = { startLine: number; endLine: number };

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

function joinRun(run: Walked[]): string[] {
  const first = run[0];
  if (first === null || first === undefined) return [];
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
  const parsed = parsePatch(patch);
  if (parsed.kind !== 'valid') return parsed.kind === 'empty' ? patch : null;
  const { header, hunks } = parsed;
  const near = (position: number) =>
    spans.some(
      (span) =>
        position >= span.startLine - context &&
        position <= span.endLine + context,
    );
  const out: string[] = [...header];
  for (const hunk of hunks) {
    let run: Walked[] = [];
    for (const entry of hunk.lines) {
      const line = { ...entry, text: entry.source };
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

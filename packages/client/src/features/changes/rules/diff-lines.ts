import { parsePatchFiles } from '@pierre/diffs/utils/parsePatchFiles';
import { parseLineType } from '@pierre/diffs/utils/parseLineType';

export type DiffLine = {
  id: string;
  text: string;
  oldLine?: number;
  newLine?: number;
  kind?: 'context' | 'added' | 'removed' | 'gap';
};
type HunkLine = {
  source: string;
  line: DiffLine;
  oldLine: number;
  newLine: number;
  position: number;
};
type DiffHunk = { header: DiffLine; lines: HunkLine[] };
type ReadDiff =
  | { kind: 'valid'; header: string[]; hunks: DiffHunk[]; changes: number }
  | { kind: 'empty' }
  | { kind: 'invalid' };

export function readDiff(patch: string): ReadDiff {
  if (patch.trim() === '') return { kind: 'empty' };
  const source = patch.split('\n');
  if (source.at(-1) === '') source.pop();
  const start = source.findIndex((line) => line.startsWith('@@'));
  if (start < 0) return { kind: 'invalid' };
  try {
    const input = source[0]?.startsWith('@@')
      ? `diff --git a/excerpt b/excerpt\n${patch}`
      : patch;
    const files = parsePatchFiles(input, undefined, true).flatMap(
      (parsed) => parsed.files,
    );
    const file = files[0];
    if (files.length !== 1 || !file?.hunks.length) return { kind: 'invalid' };
    let index = start;
    let changes = 0;
    const hunks: DiffHunk[] = [];
    for (const hunk of file.hunks) {
      if (source[index] !== hunk.hunkSpecs?.replace(/\n$/, ''))
        return { kind: 'invalid' };
      const header = { id: `patch:${index}`, text: source[index++] ?? '' };
      const lines: HunkLine[] = [];
      let oldLine = hunk.deletionStart || 1;
      let newLine = hunk.additionStart || 1;
      const add = (kind: 'context' | 'removed' | 'added') => {
        const text = source[index] ?? '';
        const parsed = parseLineType(text);
        const expected =
          kind === 'removed'
            ? 'deletion'
            : kind === 'added'
              ? 'addition'
              : 'context';
        if (parsed?.type !== expected) return false;
        const entry: HunkLine = {
          source: text,
          line: {
            id: `patch:${index++}`,
            text: text.slice(1),
            kind,
            ...(kind !== 'added' ? { oldLine } : {}),
            ...(kind !== 'removed' ? { newLine } : {}),
          },
          oldLine,
          newLine,
          position: newLine,
        };
        lines.push(entry);
        if (kind !== 'added') oldLine++;
        if (kind !== 'removed') newLine++;
        if (kind !== 'context') changes++;
        if (source[index] === '\\ No newline at end of file') {
          lines.push({
            ...entry,
            source: '\\ No newline at end of file',
            line: {
              id: `patch:${index++}`,
              text: '\\ No newline at end of file',
            },
          });
        }
        return true;
      };
      for (const content of hunk.hunkContent) {
        if (content.type === 'context') {
          for (let line = 0; line < content.lines; line++) {
            if (!add('context')) return { kind: 'invalid' };
          }
        } else {
          for (
            let line = 0;
            line < content.deletions + content.additions;
            line++
          ) {
            const type = parseLineType(source[index] ?? '')?.type;
            if (!add(type === 'deletion' ? 'removed' : 'added'))
              return { kind: 'invalid' };
          }
        }
      }
      hunks.push({ header, lines });
    }
    if (index !== source.length) return { kind: 'invalid' };
    return { kind: 'valid', header: source.slice(0, start), hunks, changes };
  } catch {
    return { kind: 'invalid' };
  }
}

export function diffLines(
  patch: string,
):
  | { kind: 'text'; lines: readonly DiffLine[] }
  | { kind: 'empty' }
  | { kind: 'invalid' } {
  const parsed = readDiff(patch);
  if (parsed.kind !== 'valid') return parsed;
  return parsed.changes === 0
    ? { kind: 'empty' }
    : {
        kind: 'text',
        lines: parsed.hunks.flatMap((hunk) => [
          hunk.header,
          ...hunk.lines.map((entry) => entry.line),
        ]),
      };
}

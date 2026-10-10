export type PatchLine = {
  id: string;
  text: string;
  oldLine?: number;
  newLine?: number;
  kind?: 'context' | 'added' | 'removed' | 'gap';
};
type HunkLine = {
  source: string;
  line: PatchLine;
  oldLine: number;
  newLine: number;
  position: number;
};
type PatchHunk = { header: PatchLine; lines: HunkLine[] };
export type ParsedPatch =
  | { kind: 'valid'; header: string[]; hunks: PatchHunk[]; changes: number }
  | { kind: 'empty' }
  | { kind: 'invalid' };

export function parsePatch(patch: string): ParsedPatch {
  if (patch.trim() === '') return { kind: 'empty' };
  const header: string[] = [];
  const hunks: PatchHunk[] = [];
  let oldLine = 0;
  let newLine = 0;
  let oldRemaining = 0;
  let newRemaining = 0;
  let changes = 0;
  const source = patch.split('\n');
  if (source.at(-1) === '') source.pop();
  for (const [index, text] of source.entries()) {
    const id = `patch:${index}`;
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(
      text,
    );
    if (match) {
      if (oldRemaining !== 0 || newRemaining !== 0) return { kind: 'invalid' };
      oldLine = Number(match[1]);
      newLine = Number(match[3]);
      oldRemaining = Number(match[2] ?? 1);
      newRemaining = Number(match[4] ?? 1);
      hunks.push({ header: { id, text }, lines: [] });
      continue;
    }
    const hunk = hunks.at(-1);
    if (!hunk) {
      if (text.startsWith('@@')) return { kind: 'invalid' };
      header.push(text);
      continue;
    }
    const entry: HunkLine = {
      source: text,
      line: { id, text },
      oldLine: oldLine === 0 ? 1 : oldLine,
      newLine: newLine === 0 ? 1 : newLine,
      position: newLine === 0 ? 1 : newLine,
    };
    if (text === '\\ No newline at end of file') {
      hunk.lines.push(entry);
      continue;
    }
    if (oldRemaining === 0 && newRemaining === 0) return { kind: 'invalid' };
    switch (text[0]) {
      case ' ':
        oldRemaining -= 1;
        newRemaining -= 1;
        entry.line = {
          id,
          text: text.slice(1),
          kind: 'context',
          oldLine: oldLine++,
          newLine: newLine++,
        };
        break;
      case '-':
        oldRemaining -= 1;
        changes += 1;
        entry.line = {
          id,
          text: text.slice(1),
          kind: 'removed',
          oldLine: oldLine++,
        };
        break;
      case '+':
        newRemaining -= 1;
        changes += 1;
        entry.line = {
          id,
          text: text.slice(1),
          kind: 'added',
          newLine: newLine++,
        };
        break;
      default:
        return { kind: 'invalid' };
    }
    if (oldRemaining < 0 || newRemaining < 0) return { kind: 'invalid' };
    hunk.lines.push(entry);
  }
  return hunks.length === 0 || oldRemaining !== 0 || newRemaining !== 0
    ? { kind: 'invalid' }
    : { kind: 'valid', header, hunks, changes };
}
export type PatchLines =
  | { kind: 'text'; lines: readonly PatchLine[] }
  | { kind: 'empty' }
  | { kind: 'invalid' };
export function patchLines(patch: string): PatchLines {
  const parsed = parsePatch(patch);
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

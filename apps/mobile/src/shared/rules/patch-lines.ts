import type { RenderLine } from './render-model';

export type PatchLines =
  | { kind: 'text'; lines: readonly RenderLine[] }
  | { kind: 'empty' }
  | { kind: 'invalid' };

export function patchLines(patch: string): PatchLines {
  if (patch.trim() === '') return { kind: 'empty' };
  const lines: RenderLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let oldRemaining = 0;
  let newRemaining = 0;
  let hunks = 0;
  let changes = 0;
  const source = patch.split('\n');
  if (source.at(-1) === '') source.pop();
  for (const [index, text] of source.entries()) {
    const id = `patch:${index}`;
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(
      text,
    );
    if (hunk) {
      if (oldRemaining !== 0 || newRemaining !== 0) return { kind: 'invalid' };
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[3]);
      oldRemaining = Number(hunk[2] ?? 1);
      newRemaining = Number(hunk[4] ?? 1);
      hunks += 1;
      lines.push({ id, text });
      continue;
    }
    if (text === '\\ No newline at end of file' && hunks > 0) {
      lines.push({ id, text });
      continue;
    }
    if (oldRemaining > 0 || newRemaining > 0) {
      switch (text[0]) {
        case ' ':
          oldRemaining -= 1;
          newRemaining -= 1;
          lines.push({
            id,
            text: text.slice(1),
            kind: 'context',
            oldLine: oldLine++,
            newLine: newLine++,
          });
          break;
        case '-':
          oldRemaining -= 1;
          changes += 1;
          lines.push({
            id,
            text: text.slice(1),
            kind: 'removed',
            oldLine: oldLine++,
          });
          break;
        case '+':
          newRemaining -= 1;
          changes += 1;
          lines.push({
            id,
            text: text.slice(1),
            kind: 'added',
            newLine: newLine++,
          });
          break;
        default:
          return { kind: 'invalid' };
      }
      if (oldRemaining < 0 || newRemaining < 0) return { kind: 'invalid' };
    } else if (hunks > 0 || text.startsWith('@@')) {
      return { kind: 'invalid' };
    }
  }
  if (hunks === 0 || oldRemaining !== 0 || newRemaining !== 0)
    return { kind: 'invalid' };
  return changes === 0 ? { kind: 'empty' } : { kind: 'text', lines };
}

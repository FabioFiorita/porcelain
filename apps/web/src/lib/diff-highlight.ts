import { highlightedLines } from './code-highlight';

type Tokens = ReturnType<typeof highlightedLines>[number];
type DiffLine = {
  kind: 'inserted' | 'deleted' | 'context' | 'meta';
  oldNumber: number | null;
  newNumber: number | null;
  marker: string;
  tokens: Tokens;
};
type Hunk = {
  old: number;
  next: number;
  oldRemaining: number;
  newRemaining: number;
  rows: {
    text: string;
    kind: DiffLine['kind'];
    oldNumber: number | null;
    newNumber: number | null;
  }[];
};

// Reconstruct each side of a hunk before tokenization so removed lines cannot
// change the syntax state of added lines. Gaps between hunks reset that state.
export function highlightedDiffLines(
  patch: string,
  language: string,
): DiffLine[] {
  const result: DiffLine[] = [];
  const state: { hunk: Hunk | null } = { hunk: null };
  const flush = () => {
    if (state.hunk) {
      for (const row of highlightHunk(state.hunk, language)) result.push(row);
    }
    state.hunk = null;
  };
  for (const text of patch.split('\n')) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text);
    if (header) {
      flush();
      result.push(metadata(hunkLabel(header)));
      state.hunk = {
        old: Number(header[1]),
        next: Number(header[3]),
        oldRemaining: Number(header[2] ?? 1),
        newRemaining: Number(header[4] ?? 1),
        rows: [],
      };
    } else if (state.hunk && appendHunkLine(state.hunk, text)) {
      // The hunk owns source lines, including code that begins with --- or +++.
    } else {
      flush();
      if (text && !/^(?:diff --git |index |--- |\+\+\+ )/.test(text))
        result.push(metadata(text));
    }
  }
  flush();
  return result;
}
function metadata(text: string): DiffLine {
  return {
    kind: 'meta',
    oldNumber: null,
    newNumber: null,
    marker: '',
    tokens: [{ value: text, className: 'meta', offset: 0 }],
  };
}
function appendHunkLine(hunk: Hunk, text: string) {
  if (text.startsWith('\\')) {
    hunk.rows.push({ text, kind: 'meta', oldNumber: null, newNumber: null });
    return true;
  }
  const marker = text[0];
  if (![' ', '+', '-'].includes(marker ?? '')) return false;
  const old = marker !== '+';
  const next = marker !== '-';
  if ((old && hunk.oldRemaining <= 0) || (next && hunk.newRemaining <= 0))
    return false;
  hunk.rows.push({
    text: text.slice(1),
    kind: marker === '+' ? 'inserted' : marker === '-' ? 'deleted' : 'context',
    oldNumber: old ? hunk.old : null,
    newNumber: next ? hunk.next : null,
  });
  if (old) {
    hunk.old += 1;
    hunk.oldRemaining -= 1;
  }
  if (next) {
    hunk.next += 1;
    hunk.newRemaining -= 1;
  }
  return true;
}
function highlightHunk(hunk: Hunk, language: string): DiffLine[] {
  const old = highlightedLines(
    hunk.rows
      .filter((row) => row.oldNumber !== null)
      .map((row) => row.text)
      .join('\n'),
    language,
  );
  const next = highlightedLines(
    hunk.rows
      .filter((row) => row.newNumber !== null)
      .map((row) => row.text)
      .join('\n'),
    language,
  );
  const cursor = { old: 0, next: 0 };
  return hunk.rows.map((row) => {
    if (row.kind === 'meta') return metadata(row.text);
    const tokens = row.kind === 'deleted' ? old[cursor.old] : next[cursor.next];
    if (row.oldNumber !== null) cursor.old += 1;
    if (row.newNumber !== null) cursor.next += 1;
    return {
      ...row,
      marker:
        row.kind === 'inserted' ? '+' : row.kind === 'deleted' ? '-' : ' ',
      tokens: tokens ?? [],
    };
  });
}

function hunkLabel(header: RegExpExecArray) {
  const oldStart = Number(header[1]);
  const oldCount = Number(header[2] ?? 1);
  const newStart = Number(header[3]);
  const newCount = Number(header[4] ?? 1);
  const range = (start: number, count: number) =>
    count === 1 ? `line ${start}` : `lines ${start}–${start + count - 1}`;
  if (oldCount === 0) return `Added ${range(newStart, newCount)}`;
  if (newCount === 0) return `Removed ${range(oldStart, oldCount)}`;
  return `${range(newStart, newCount).replace(/^line/, 'Line')} · previously ${range(oldStart, oldCount)}`;
}

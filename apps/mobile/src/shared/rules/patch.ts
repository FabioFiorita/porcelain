import type { ReadChangeDiffsResponse } from '@porcelain/contracts/changes';

export type DiffContent = ReadChangeDiffsResponse['diffs'][number]['content'];
type ParsedPatchFile = {
  oldFileName?: string | undefined;
  newFileName?: string | undefined;
  isCreate?: boolean | undefined;
  isDelete?: boolean | undefined;
  isBinary?: boolean | undefined;
  hunks: {
    oldStart: number;
    newStart: number;
    oldLines: number;
    newLines: number;
    lines: string[];
  }[];
};
type PatchParser = (patch: string) => ParsedPatchFile[];
export type DiffRow = {
  id: string;
  kind:
    | 'header'
    | 'metadata'
    | 'hunk'
    | 'context'
    | 'addition'
    | 'deletion'
    | 'notice'
    | 'raw';
  text: string;
  path?: string | undefined;
  oldLine?: number;
  newLine?: number;
};

const omitted: Record<
  Extract<DiffContent, { kind: 'omitted' }>['reason'],
  string
> = {
  'size-limit': 'Diff omitted: file exceeds the size limit.',
  'unsupported-encoding': 'Diff omitted: unsupported file encoding.',
  'unsupported-submodule': 'Diff omitted: submodule changes are not supported.',
};

function barePath(path: string | undefined) {
  if (!path || path === '/dev/null') return undefined;
  return path.replace(/^[ab]\//, '');
}

function patchHeaders(patch: string, files: ParsedPatchFile[]) {
  const lines = patch.split('\n');
  const metadata = files.map(() => [] as string[]);
  const hunks = files.flatMap((file) => file.hunks);
  const headers: string[] = [];
  let fileIndex = -1;
  let hasOldHeader = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (/^(?:diff --git |Index: |diff(?: -r \w+)+\s)/.test(line)) {
      fileIndex++;
      hasOldHeader = false;
    } else if (line.startsWith('--- ')) {
      if (fileIndex < 0) fileIndex = 0;
      else if (hasOldHeader) fileIndex++;
      hasOldHeader = true;
    } else if (line.startsWith('+++ ') || /^=+$/.test(line) || line === '') {
      continue;
    } else if (line.startsWith('@@')) {
      if (!/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@.*$/.test(line))
        throw new Error('Invalid hunk header');
      const hunk = hunks[headers.length];
      if (!hunk) throw new Error('Unparsed hunk');
      headers.push(line);
      index += hunk.lines.length;
    } else if (
      /^(?:(?:old|new|deleted file|new file) mode \d+|(?:dis)?similarity index \d+%|index [a-f\d]+\.\.[a-f\d]+(?: \d+)?|(?:rename|copy) (?:from|to) .+|Binary files .+ differ)$/.test(
        line,
      )
    ) {
      if (fileIndex < 0) fileIndex = 0;
      const fileMetadata = metadata[fileIndex];
      if (!fileMetadata) throw new Error('Unexpected file metadata');
      fileMetadata.push(line);
    } else throw new Error('Unsupported patch content');
  }
  if (headers.length !== hunks.length) throw new Error('Missing hunk header');
  return { headers, metadata };
}

export function diffRows(
  content: DiffContent,
  parse: PatchParser,
  path?: string,
): DiffRow[] {
  const rows: DiffRow[] = [];
  const push = (row: Omit<DiffRow, 'id'>) =>
    rows.push({ ...row, id: `file-diff-row-${rows.length}` });
  const header = () => {
    if (path) push({ kind: 'header', text: path, path });
  };
  if (content.kind === 'binary' || content.kind === 'omitted') {
    header();
    push({
      kind: 'notice',
      text:
        content.kind === 'binary'
          ? 'Binary file changed.'
          : omitted[content.reason],
    });
    return rows;
  }
  if (!content.patch.trim()) {
    header();
    push({ kind: 'notice', text: 'No text changes.' });
    return rows;
  }
  try {
    const files = parse(content.patch);
    if (
      !files.length ||
      files.every(
        (file) => !file.oldFileName && !file.newFileName && !file.hunks.length,
      )
    )
      throw new Error('No unified patch found');
    const { headers, metadata } = patchHeaders(content.patch, files);
    let hunkIndex = 0;
    for (const [fileIndex, file] of files.entries()) {
      const oldPath = barePath(file.oldFileName);
      const newPath = barePath(file.newFileName);
      const filePath = newPath ?? oldPath ?? path;
      push({ kind: 'header', text: filePath ?? 'File diff', path: filePath });
      for (const text of metadata[fileIndex] ?? []) {
        if (text.startsWith('Binary files ')) continue;
        const from = /^(rename|copy) from /.exec(text);
        const to = /^(rename|copy) to /.exec(text);
        push({
          kind: 'metadata',
          text: from
            ? `${from[1]} from ${oldPath}`
            : to
              ? `${to[1]} to ${newPath}`
              : text,
        });
      }
      if (!file.isCreate && file.oldFileName === '/dev/null')
        push({ kind: 'metadata', text: 'New file' });
      if (!file.isDelete && file.newFileName === '/dev/null')
        push({ kind: 'metadata', text: 'Deleted file' });
      if (file.isBinary) push({ kind: 'notice', text: 'Binary file changed.' });
      else if (!file.hunks.length)
        push({ kind: 'notice', text: 'Metadata changes only.' });
      for (const hunk of file.hunks) {
        if (
          ![hunk.oldStart, hunk.newStart, hunk.oldLines, hunk.newLines].every(
            Number.isSafeInteger,
          ) ||
          hunk.oldStart < 1 ||
          hunk.newStart < 1 ||
          !Number.isSafeInteger(hunk.oldStart + hunk.oldLines - 1) ||
          !Number.isSafeInteger(hunk.newStart + hunk.newLines - 1)
        )
          throw new Error('Invalid line range');
        push({ kind: 'hunk', text: headers[hunkIndex++]! });
        let oldLine = hunk.oldStart;
        let newLine = hunk.newStart;
        for (const line of hunk.lines) {
          if (line === '\\ No newline at end of file') {
            push({ kind: 'notice', text: line });
          } else if (line.startsWith('+')) {
            push({
              kind: 'addition',
              text: line.slice(1),
              newLine: newLine++,
              path: filePath,
            });
          } else if (line.startsWith('-')) {
            push({
              kind: 'deletion',
              text: line.slice(1),
              oldLine: oldLine++,
              path: filePath,
            });
          } else if (line.startsWith(' ') || line === '') {
            push({
              kind: 'context',
              text: line.slice(1),
              oldLine: oldLine++,
              newLine: newLine++,
              path: filePath,
            });
          } else throw new Error('Unknown patch line');
        }
      }
    }
    return rows;
  } catch {
    rows.length = 0;
    header();
    push({
      kind: 'notice',
      text: 'Diff could not be parsed. Original patch follows.',
    });
    for (const text of content.patch.split('\n')) push({ kind: 'raw', text });
    return rows;
  }
}

export function diffRowLabel(row: DiffRow) {
  if (row.kind === 'addition') return `Added line ${row.newLine}: ${row.text}`;
  if (row.kind === 'deletion')
    return `Deleted line ${row.oldLine}: ${row.text}`;
  if (row.kind === 'context')
    return `Old line ${row.oldLine}, new line ${row.newLine}: ${row.text}`;
  return row.text;
}

type SourceToken = {
  text: string;
  kind: 'plain' | 'string' | 'comment' | 'keyword' | 'number';
};

export function sourceTokens(text: string, path?: string): SourceToken[] {
  if (
    !path ||
    !/\.(?:[cm]?[jt]sx?|swift|kt|java|c|cpp|h|rs|go|py|rb|sh)$/.test(path)
  )
    return [{ text, kind: 'plain' }];
  const hashComments = /\.(?:py|rb|sh)$/.test(path);
  const tokens: SourceToken[] = [];
  const pattern =
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|#.*|\b(?:import|from|export|default|const|let|var|function|class|struct|enum|interface|type|return|if|else|for|while|switch|case|break|continue|async|await|throw|try|catch|new|public|private|static|func|def|fn|val|true|false|null|nil|None)\b|\b\d+(?:\.\d+)?\b/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset)
      tokens.push({ text: text.slice(offset, match.index), kind: 'plain' });
    const value = match[0];
    const comment = hashComments
      ? value.startsWith('#')
      : value.startsWith('//');
    const kind = comment
      ? 'comment'
      : value.startsWith('#') || value.startsWith('//')
        ? 'plain'
        : /^['"]/.test(value)
          ? 'string'
          : /^\d/.test(value)
            ? 'number'
            : 'keyword';
    tokens.push({ text: value, kind });
    offset = match.index + value.length;
  }
  if (offset < text.length)
    tokens.push({ text: text.slice(offset), kind: 'plain' });
  return tokens;
}

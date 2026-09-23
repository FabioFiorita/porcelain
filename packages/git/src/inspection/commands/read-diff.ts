import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';

const MAX_PATCH_BYTES = 1024 * 1024;
const MAX_BATCH_BYTES = 32 * 1024 * 1024;

export async function readDiff(
  session: CheckoutSession,
  change: GitOrdinaryChange,
  signal?: AbortSignal,
): Promise<GitDiffResult> {
  const [result] = await readDiffs(session, [change], signal);
  if (!result) throw new Error('Missing diff result');
  return result;
}

export async function readDiffs(
  session: CheckoutSession,
  changes: readonly GitOrdinaryChange[],
  signal?: AbortSignal,
): Promise<GitDiffResult[]> {
  const needsFilters = changes.some(
    (change) => change.supported && change.scope === 'unstaged',
  );
  const config = needsFilters
    ? await sessionConversionFilters(session, signal)
    : [];
  const results = new Map<GitOrdinaryChange, GitDiffResult>();
  for (const change of changes)
    if (!change.supported)
      results.set(change, { kind: 'omitted', reason: 'unsupported-submodule' });
  for (const scope of ['staged', 'unstaged'] as const) {
    const wanted = changes.filter(
      (change) => change.supported && change.scope === scope,
    );
    if (wanted.length === 0) continue;
    const sections = await readSections(
      session.path,
      { kind: scope },
      wanted.flatMap(changePaths),
      scope === 'unstaged' ? config : [],
      signal,
    );
    for (const change of wanted)
      results.set(
        change,
        sections === null
          ? { kind: 'omitted', reason: 'size-limit' }
          : (sections.get(keyOf(changePaths(change))) ?? {
              kind: 'metadata-only',
              patch: '',
            }),
      );
  }
  return changes.map((change) => {
    const result = results.get(change);
    if (!result) throw new Error('Missing diff result');
    return result;
  });
}

export async function readCommitDiffs(
  checkout: string,
  oid: string,
  parent: number,
  paths: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, GitDiffResult> | null> {
  return readSections(
    checkout,
    { kind: 'commit', oid, parent },
    paths,
    [],
    signal,
  );
}

function changePaths(change: GitOrdinaryChange) {
  return [...new Set([change.oldPath, change.newPath])].filter(
    (path): path is string => path !== null,
  );
}

const keyOf = (paths: readonly string[]) => paths.join('\0');

type DiffComparison =
  | { kind: 'staged' }
  | { kind: 'unstaged' }
  | { kind: 'commit'; oid: string; parent: number };

function diffArguments(comparison: DiffComparison, pathspecs: string[]) {
  return [
    ...(comparison.kind === 'commit'
      ? [
          'diff-tree',
          '--no-commit-id',
          '-r',
          ...(comparison.parent === 1
            ? ['--root', '--diff-merges=first-parent']
            : []),
        ]
      : ['diff', ...(comparison.kind === 'staged' ? ['--cached'] : [])]),
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '--find-renames=50%',
    '--diff-algorithm=myers',
    '--no-indent-heuristic',
    '--unified=3',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--no-relative',
    '--raw',
    '-z',
    '--patch',
    ...(comparison.kind === 'commit'
      ? comparison.parent === 1
        ? [comparison.oid]
        : [`${comparison.oid}^${comparison.parent}`, comparison.oid]
      : []),
    '--',
    ...pathspecs,
  ];
}

function pathspec(path: string) {
  return `:(top,literal)${path}`;
}

async function readSections(
  checkout: string,
  comparison: DiffComparison,
  paths: readonly string[],
  config: string[],
  signal?: AbortSignal,
): Promise<Map<string, GitDiffResult> | null> {
  const pathspecs = [...new Set(paths.map((path) => pathspec(path)))];
  let output: Buffer;
  try {
    output = await runInspection(
      checkout,
      diffArguments(comparison, pathspecs),
      signal,
      { maxBytes: MAX_BATCH_BYTES, config },
    );
  } catch (error) {
    if (error instanceof InspectionLimitError) return null;
    throw error;
  }
  const { entries, patch } = splitRaw(output);
  const sections = splitSections(patch);
  const results = new Map<string, GitDiffResult>();
  let at = 0;
  for (const entry of entries) {
    const owned = entry.status.startsWith('T') ? 2 : 1;
    if (at + owned > sections.length)
      throw new Error('Git described more files than it printed');
    results.set(
      keyOf(entry.paths),
      classify(Buffer.concat(sections.slice(at, at + owned))),
    );
    at += owned;
  }
  if (at !== sections.length)
    throw new Error('Git printed more files than it described');
  return results;
}

function splitRaw(output: Buffer) {
  const entries: {
    status: string;
    paths: string[];
    oldMode: string;
    newMode: string;
  }[] = [];
  let at = 0;
  const field = () => {
    const end = output.indexOf(0, at);
    if (end === -1) return null;
    const value = output.subarray(at, end).toString('utf8');
    at = end + 1;
    return value;
  };
  while (at < output.length && output[at] === 0x3a) {
    const meta = field();
    if (meta === null) break;
    const parts = meta.split(' ');
    const status = parts.at(-1) ?? '';
    const first = field();
    if (first === null) break;
    const second = /^[RC]/.test(status) ? field() : null;
    if (second === null && /^[RC]/.test(status)) break;
    entries.push({
      status,
      paths: second === null ? [first] : [...new Set([first, second])],
      oldMode: (parts[0] ?? '').slice(1),
      newMode: parts[1] ?? '',
    });
  }
  if (output[at] === 0) at += 1;
  return { entries, patch: output.subarray(at) };
}

function splitSections(patch: Buffer) {
  const header = Buffer.from('diff --git ');
  const starts: number[] = [];
  for (let at = 0; at < patch.length; at += 1) {
    if (
      (at === 0 || patch[at - 1] === 0x0a) &&
      patch.subarray(at, at + header.length).equals(header)
    )
      starts.push(at);
  }
  return starts.map((start, index) =>
    patch.subarray(start, starts[index + 1] ?? patch.length),
  );
}

function classify(section: Buffer | undefined): GitDiffResult {
  if (!section) return { kind: 'metadata-only', patch: '' };
  if (section.byteLength > MAX_PATCH_BYTES)
    return { kind: 'omitted', reason: 'size-limit' };
  let patch: string;
  try {
    patch = new TextDecoder('utf-8', { fatal: true }).decode(section);
  } catch {
    return { kind: 'omitted', reason: 'unsupported-encoding' };
  }
  if (/^Binary files .* differ$/m.test(patch)) return { kind: 'binary' };
  return { kind: /^@@ /m.test(patch) ? 'text' : 'metadata-only', patch };
}

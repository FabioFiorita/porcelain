import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';

/** One file's patch may be large; the batch holding several of them, more so. */
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

/**
 * The patches for several changes, in one Git process per scope — always one,
 * however large the batch or however odd the filenames in it.
 *
 * Git is asked for `--raw -z` alongside the patch, so the same process states
 * which files it is about to print and in what order, with NUL-delimited paths
 * that need no unquoting. Sections are then taken in that order. Matching the
 * `diff --git` header text instead would fail on exactly the names Git has to
 * quote, and falling back to a process per file would undo the reason for
 * batching at the moment it is needed most.
 *
 * The patch is split as bytes and each section decoded on its own, so one file
 * that is not valid UTF-8 is omitted alone rather than spoiling the batch.
 *
 * The request's filter check is reused; it is not repeated around the batch.
 */
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
    const sections = await readScope(
      session.path,
      scope,
      wanted,
      scope === 'unstaged' ? config : [],
      signal,
    );
    for (const change of wanted)
      results.set(
        change,
        sections === null
          ? // The whole scope was larger than a response may be. Every file in
            // it says so, rather than the server reading each one again.
            { kind: 'omitted', reason: 'size-limit' }
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

function changePaths(change: GitOrdinaryChange) {
  return [...new Set([change.oldPath, change.newPath])].filter(
    (path): path is string => path !== null,
  );
}

const keyOf = (paths: readonly string[]) => paths.join('\0');

function diffArguments(scope: 'staged' | 'unstaged', pathspecs: string[]) {
  return [
    'diff',
    ...(scope === 'staged' ? ['--cached'] : []),
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
    // The raw entries name the files, in order, without quoting; the patch
    // that follows prints them in the same order.
    '--raw',
    '-z',
    '--patch',
    '--',
    ...pathspecs,
  ];
}

// Literal pathspecs also match descendants. Escaping every codepoint in a
// glob pathspec forces exact matching, including for a rename foo -> foo/bar.
function pathspec(path: string) {
  return `:(top,glob)${[...path].map((character) => `\\${character}`).join('')}`;
}

/** Null when the scope was larger than one response may carry. */
async function readScope(
  checkout: string,
  scope: 'staged' | 'unstaged',
  changes: readonly GitOrdinaryChange[],
  config: string[],
  signal?: AbortSignal,
): Promise<Map<string, GitDiffResult> | null> {
  const pathspecs = [
    ...new Set(changes.flatMap(changePaths).map((path) => pathspec(path))),
  ];
  let output: Buffer;
  try {
    output = await runInspection(
      checkout,
      diffArguments(scope, pathspecs),
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
    // A change of type is printed as a deletion and a creation, so it owns two
    // sections; everything else owns one. Both halves come from one diff
    // queue, so anything else is this parser being wrong rather than the
    // repository — and guessing would show a reviewer one file's changes under
    // another file's name.
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

/**
 * The `--raw -z` header: `:<modes> <oids> <status>\0<path>\0`, twice over for
 * a rename, then one empty field, then the patch.
 */
function splitRaw(output: Buffer) {
  const entries: { status: string; paths: string[] }[] = [];
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
    // The status letter is last: R and C name a source and a destination.
    const status = meta.split(' ').at(-1) ?? '';
    const first = field();
    if (first === null) break;
    const second = /^[RC]/.test(status) ? field() : null;
    if (second === null && /^[RC]/.test(status)) break;
    entries.push({
      status,
      paths: second === null ? [first] : [...new Set([first, second])],
    });
  }
  // The empty field that closes the raw section.
  if (output[at] === 0) at += 1;
  return { entries, patch: output.subarray(at) };
}

/** Sections as bytes, so one undecodable file does not spoil the batch. */
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
  // Hunk lines start with +, - or a space, so content cannot match this.
  if (/^Binary files .* differ$/m.test(patch)) return { kind: 'binary' };
  return { kind: /^@@ /m.test(patch) ? 'text' : 'metadata-only', patch };
}

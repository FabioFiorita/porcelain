import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import { executeInspection } from '../execute-inspection.ts';
import { checkConversionFilters } from './check-conversion-filters.ts';

export async function readDiff(
  checkout: string,
  change: GitOrdinaryChange,
  signal?: AbortSignal,
): Promise<GitDiffResult> {
  const [result] = await readDiffs(checkout, [change], signal);
  if (!result) throw new Error('Missing diff result');
  return result;
}

/** Checks conversion filters once around the whole batch, not once per change. */
export async function readDiffs(
  checkout: string,
  changes: readonly GitOrdinaryChange[],
  signal?: AbortSignal,
): Promise<GitDiffResult[]> {
  const converted = [
    ...new Set(
      changes
        .filter((change) => change.supported && change.scope === 'unstaged')
        .flatMap(changePaths),
    ),
  ];
  const config =
    converted.length > 0
      ? await checkConversionFilters(checkout, signal, converted)
      : [];
  const results: GitDiffResult[] = [];
  for (let offset = 0; offset < changes.length; offset += 8) {
    const loaded = await Promise.allSettled(
      changes
        .slice(offset, offset + 8)
        .map((change) =>
          readPatch(
            checkout,
            change,
            change.scope === 'unstaged' ? config : [],
            signal,
          ),
        ),
    );
    for (const result of loaded) {
      if (result.status === 'rejected') throw result.reason;
      results.push(result.value);
    }
  }
  if (converted.length > 0)
    await checkConversionFilters(checkout, signal, converted);
  return results;
}

function changePaths(change: GitOrdinaryChange) {
  return [change.oldPath, change.newPath].filter((path) => path !== null);
}

async function readPatch(
  checkout: string,
  change: GitOrdinaryChange,
  config: string[],
  signal?: AbortSignal,
): Promise<GitDiffResult> {
  if (!change.supported)
    return { kind: 'omitted', reason: 'unsupported-submodule' };
  // Literal pathspecs also match descendants. Escaping every codepoint in a
  // glob pathspec forces exact matching, including for a rename foo -> foo/bar.
  const pathspecs = [...new Set(changePaths(change))].map(
    (path) =>
      `:(top,glob)${[...path].map((character) => `\\${character}`).join('')}`,
  );
  try {
    const output = await executeInspection(
      checkout,
      [
        'diff',
        ...(change.scope === 'staged' ? ['--cached'] : []),
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
        '--patch',
        '--',
        ...pathspecs,
      ],
      1024 * 1024,
      signal,
      config,
    );
    try {
      const patch = new TextDecoder('utf-8', { fatal: true }).decode(output);
      // Hunk lines start with +, - or a space, so content cannot match this.
      if (/^Binary files .* differ$/m.test(patch)) return { kind: 'binary' };
      return { kind: /^@@ /m.test(patch) ? 'text' : 'metadata-only', patch };
    } catch {
      return { kind: 'omitted', reason: 'unsupported-encoding' };
    }
  } catch (error) {
    if (error instanceof InspectionLimitError)
      return { kind: 'omitted', reason: 'size-limit' };
    throw error;
  }
}

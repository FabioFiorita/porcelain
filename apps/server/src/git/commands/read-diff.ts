import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import { executeInspection } from '../execute-inspection.ts';

export async function readDiff(
  checkout: string,
  change: GitOrdinaryChange,
  signal?: AbortSignal,
): Promise<GitDiffResult> {
  if (!change.supported)
    return { kind: 'omitted', reason: 'unsupported-submodule' };
  const paths = [
    ...new Set(
      [change.oldPath, change.newPath].filter((path) => path !== null),
    ),
  ];
  // Literal pathspecs also match descendants. Escaping every codepoint in a
  // glob pathspec forces exact matching, including for a rename foo -> foo/bar.
  const pathspecs = paths.map(
    (path) =>
      `:(top,glob)${[...path].map((character) => `\\${character}`).join('')}`,
  );
  const args = [
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
  ];
  try {
    const statistics = await executeInspection(
      checkout,
      [...args, '--numstat', '-z', '--', ...pathspecs],
      1024 * 1024,
      signal,
    );
    if (statistics.subarray(0, 4).equals(Buffer.from('-\t-\t')))
      return { kind: 'binary' };
    const output = await executeInspection(
      checkout,
      [...args, '--patch', '--', ...pathspecs],
      1024 * 1024,
      signal,
    );
    try {
      const patch = new TextDecoder('utf-8', { fatal: true }).decode(output);
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

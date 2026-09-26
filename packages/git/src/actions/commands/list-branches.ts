import { shortBranchName } from '../../shared/parsers/refs.ts';
import type { GitBranchList } from '../dtos/git-branch-list.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionCommand } from './read-action-command.ts';

export async function listBranches(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<GitBranchList> {
  const ref = await readActionBranch(process, signal);
  const current = ref === null ? null : shortBranchName(ref);
  const rows = (
    await readActionCommand(
      process,
      [
        'for-each-ref',
        '--format=%(refname:short)%00%(upstream:short)%00%(committerdate:iso-strict)%00%(worktreepath)',
        '--sort=-committerdate',
        'refs/heads/',
      ],
      signal,
    )
  )
    .trimEnd()
    .split('\n')
    .filter(Boolean);
  return {
    current,
    branches: rows.map((row) => {
      const [name = '', upstream = '', lastCommitAt = '', worktree = ''] =
        row.split('\0');
      return {
        name,
        upstream: upstream || null,
        lastCommitAt,
        checkedOutElsewhere: Boolean(worktree && name !== current),
      };
    }),
  };
}

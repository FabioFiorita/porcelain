import {
  diffSelection,
  type Change,
  type ChangeSelection,
} from '@porcelain/client/changes/rules';
import { commitPath, commitPaths } from '@porcelain/client/history/rules';
import { refLabel } from '@porcelain/client/history/rules';
import type { ReviewSnapshot } from './comparison';
import type { DiffPageFile } from './diff-page';

type ChangeRead =
  | {
      kind: 'diff';
      selection: ChangeSelection;
      fingerprint: string | undefined;
    }
  | { kind: 'branch'; paths: readonly string[] }
  | { kind: 'untracked' }
  | { kind: 'notice'; title: string };

export type ChangeEntry = DiffPageFile & {
  scope: Change['scope'] | undefined;
  read: ChangeRead;
};

export function changeEntries(snapshot: ReviewSnapshot): ChangeEntry[] {
  if (snapshot.kind === 'branch') {
    const base = snapshot.answer.mergeBaseOid;
    return snapshot.answer.files.map((file) => ({
      key: commitPaths(file).join('\0'),
      path: commitPath(file),
      details: [
        file.status === 'renamed'
          ? `renamed from ${file.oldPath ?? ''}`
          : file.status,
      ],
      scope: undefined,
      read: base
        ? { kind: 'branch', paths: commitPaths(file) }
        : { kind: 'notice', title: 'No comparison base' },
    }));
  }
  return snapshot.answer.changes.flatMap((file) =>
    file.comparisons.map((change) => ({
      key: `${file.path}\0${change.scope}`,
      path: file.path,
      details: [
        change.scope === 'unmerged'
          ? `conflict: ${change.conflict}`
          : change.scope,
      ],
      scope: change.scope,
      read: worktreeRead(change, file.fingerprint ?? undefined),
    })),
  );
}

function worktreeRead(
  change: Change,
  fingerprint: string | undefined,
): ChangeRead {
  if (change.scope === 'untracked') return { kind: 'untracked' };
  if (change.scope === 'unmerged') return { kind: 'notice', title: 'Conflict' };
  const selection = diffSelection(change);
  if (!change.supported || !selection)
    return { kind: 'notice', title: 'Unsupported comparison' };
  return { kind: 'diff', selection, fingerprint };
}

export function changesSummary(snapshot: ReviewSnapshot, files: number) {
  const count = `${files} ${files === 1 ? 'change' : 'changes'}`;
  if (snapshot.kind === 'worktree')
    return { subtitle: 'Uncommitted', description: `${count}, not committed` };
  const { base, head, commits } = snapshot.answer;
  if (!base)
    return {
      subtitle: 'Branch · No base',
      description: 'No comparison base is available.',
    };
  return {
    subtitle: `Branch · ${refLabel(base.ref)}`,
    description: `${head.branch ?? 'Detached HEAD'} compared with ${base.ref} · ${commits} commits · ${count}`,
  };
}

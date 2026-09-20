import { describe, expect, it } from 'vitest';
import type { GitActionStatus, GitBranchStatus } from './git-action-options';
import {
  gitActionBlocker,
  gitActionGroups,
  gitActionReason,
  gitActions,
  primaryGitAction,
} from './git-action-options';

const baseStatus = (): GitActionStatus => ({
  environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
  statusToken: 'a'.repeat(64),
  consistency: 'best-effort',
  headOid: 'a'.repeat(40),
  changes: [],
});

const branch = (overrides: Partial<GitBranchStatus> = {}): GitBranchStatus => ({
  name: 'refs/heads/review',
  upstream: 'origin/review',
  ahead: 0,
  behind: 0,
  ...overrides,
});

describe('Git action options', () => {
  it('keeps only current API actions and groups them by intent', () => {
    expect(gitActions.map((action) => action.id)).toEqual([
      'commit',
      'push',
      'pull',
      'fetch',
      'stash-create',
      'stash-apply',
      'stash-pop',
    ]);
    expect(
      gitActionGroups.map((group) => [
        group.label,
        group.actions.map((action) => action.id),
      ]),
    ).toEqual([
      ['Commit', ['commit']],
      ['Sync', ['push', 'pull', 'fetch']],
      ['Stash', ['stash-create', 'stash-apply', 'stash-pop']],
    ]);
  });

  it('chooses commit first and push only for an ahead, non-behind branch', () => {
    const changed = baseStatus();
    changed.changes = [
      {
        scope: 'staged',
        kind: 'modified',
        oldPath: 'README.md',
        newPath: 'README.md',
        oldMode: '100644',
        newMode: '100644',
        supported: true,
      },
    ];
    expect(primaryGitAction(changed)).toEqual({
      kind: 'commit',
      label: 'Commit',
    });

    const ahead = baseStatus();
    ahead.branch = branch({ ahead: 2 });
    expect(primaryGitAction(ahead)).toEqual({
      kind: 'run',
      action: 'push',
      label: 'Push',
    });

    const behind = baseStatus();
    behind.branch = branch({ behind: 1 });
    const primary = primaryGitAction(behind);
    expect(primary).toEqual({ kind: 'run', action: 'pull', label: 'Pull' });
  });

  it('reports status blockers while leaving missing optional status to prepare', () => {
    const detached = baseStatus();
    detached.branch = branch({ name: null });
    expect(gitActionBlocker('push', detached)).toContain('Detached HEAD');

    const clean = baseStatus();
    expect(gitActionBlocker('push', clean)).toBeNull();
    expect(gitActionReason('commit', clean)).toContain('Nothing to commit');

    const conflicted = baseStatus();
    conflicted.changes = [
      { scope: 'unmerged', path: 'conflicted.ts', conflict: 'UU' },
    ];
    expect(gitActionBlocker('commit', conflicted)).toContain('Resolve');
  });
});

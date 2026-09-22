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
  statusToken: 'a'.repeat(64),
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
      'amend',
      'push',
      'pull',
      'fetch',
      'stash-create',
      'stash-apply',
      'stash-pop',
      'switch-branch',
      'create-branch',
    ]);
    expect(
      gitActionGroups.map((group) => [
        group.label,
        group.actions.map((action) => action.id),
      ]),
    ).toEqual([
      ['Commit', ['commit', 'amend']],
      ['Sync', ['push', 'pull', 'fetch']],
      ['Stash', ['stash-create', 'stash-pop']],
      ['Branch', ['switch-branch', 'create-branch']],
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
        oldOid: null,
        newOid: null,
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

    const noUpstream = baseStatus();
    noUpstream.branch = branch({ upstream: null });
    expect(gitActionBlocker('pull', noUpstream)).toContain('No upstream');
    expect(gitActionBlocker('fetch', noUpstream)).toContain('No upstream');

    const conflicted = baseStatus();
    conflicted.changes = [
      { scope: 'unmerged', path: 'conflicted.ts', conflict: 'UU' },
    ];
    expect(gitActionBlocker('commit', conflicted)).toContain('Resolve');
  });
});

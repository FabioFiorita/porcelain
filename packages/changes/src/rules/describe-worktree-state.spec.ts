import { describe, expect, it } from 'vitest';
import { describeWorktreeState } from './describe-worktree-state.ts';
import {
  fileChange,
  modified,
  unmerged,
} from '../../spec/fakes/comparisons.ts';

const main = { name: 'main', upstream: undefined, ahead: 0, behind: 0 };

describe('describeWorktreeState', () => {
  it('counts unresolved conflicts before other changes', () => {
    expect(
      describeWorktreeState(
        [
          fileChange('clash.md', [unmerged('clash.md')]),
          fileChange('README.md', [modified('unstaged', 'README.md')]),
        ],
        main,
      ),
    ).toBe('1 unresolved path remains on main.');
  });

  it('counts changed paths when nothing is in conflict', () => {
    expect(
      describeWorktreeState(
        [
          fileChange('a.md', [modified('unstaged', 'a.md')]),
          fileChange('b.md', [modified('unstaged', 'b.md')]),
        ],
        main,
      ),
    ).toBe('2 changed paths remain on main.');
  });

  it('reports a clean worktree on a detached head', () => {
    expect(describeWorktreeState([], undefined)).toBe(
      'The worktree is clean on detached HEAD.',
    );
  });
});

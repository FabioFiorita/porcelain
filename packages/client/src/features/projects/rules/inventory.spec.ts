import { describe, expect, it } from 'vitest';
import { worktreeLabel } from './inventory.ts';

describe('worktree labels', () => {
  it('shows branch names without the refs prefix and labels detached heads', () => {
    expect(worktreeLabel('refs/heads/topic')).toBe('topic');
    expect(worktreeLabel(null)).toBe('Detached HEAD');
  });
});

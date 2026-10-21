import { describe, expect, it } from 'vitest';
import { worktreeIsWritable } from './worktree-is-writable.ts';

describe('worktreeIsWritable', () => {
  it('allows writing to an available worktree of an available project', () => {
    expect(worktreeIsWritable({ available: true }, { available: true })).toBe(
      true,
    );
  });
});

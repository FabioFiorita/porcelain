import { describe, expect, it } from 'vitest';
import { worktreeIsWritable } from './worktree-is-writable.ts';

describe('worktreeIsWritable', () => {
  it('allows writing to an available worktree of an available project', () => {
    expect(worktreeIsWritable({ available: true }, { available: true })).toBe(
      true,
    );
  });

  it('refuses writing to a worktree whose folder is unavailable', () => {
    expect(worktreeIsWritable({ available: false }, { available: true })).toBe(
      false,
    );
  });

  it('refuses writing to a worktree of an unavailable project', () => {
    expect(worktreeIsWritable({ available: true }, { available: false })).toBe(
      false,
    );
  });

  it('refuses writing to a worktree whose project is no longer registered', () => {
    expect(worktreeIsWritable({ available: true }, undefined)).toBe(false);
  });
});

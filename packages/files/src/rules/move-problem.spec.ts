import { describe, expect, it } from 'vitest';
import { moveProblem } from './move-problem.ts';

describe('moveProblem', () => {
  it.each([
    { name: 'onto itself', destination: 'docs' },
    { name: 'into itself', destination: 'docs/guide' },
    { name: 'deep inside itself', destination: 'docs/guide/intro' },
  ])('refuses a move $name', ({ destination }) => {
    expect(moveProblem('docs', destination)).toEqual({ kind: 'into-itself' });
  });

  it.each([
    { name: 'to a sibling', destination: 'guides' },
    { name: 'to a sibling that shares its prefix', destination: 'docs-old' },
    { name: 'into its parent', destination: 'archive/docs' },
  ])('accepts a move $name', ({ destination }) => {
    expect(moveProblem('docs', destination)).toBeUndefined();
  });
});

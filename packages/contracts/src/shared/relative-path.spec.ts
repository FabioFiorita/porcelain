import { expect, it } from 'vitest';
import { relativePathSchema } from './relative-path.ts';

it('accepts normalized paths with wide Unicode characters', () => {
  expect(relativePathSchema.safeParse('docs/a😀.ts').success).toBe(true);
});

it('rejects paths escaping a worktree', () => {
  expect(relativePathSchema.safeParse('docs/../secret').success).toBe(false);
});

it('rejects Git internals in mixed case', () => {
  expect(relativePathSchema.safeParse('sub/.GIT/config').success).toBe(false);
});

it('rejects a lone surrogate', () => {
  expect(relativePathSchema.safeParse('a\ud800.ts').success).toBe(false);
});

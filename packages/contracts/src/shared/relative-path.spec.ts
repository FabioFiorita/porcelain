import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { relativePathSchema } from './relative-path.ts';

it('accepts normalized paths with wide Unicode characters', () => {
  expect(Schema.is(relativePathSchema)('docs/a😀.ts')).toBe(true);
});

it('rejects paths escaping a worktree', () => {
  expect(Schema.is(relativePathSchema)('docs/../secret')).toBe(false);
});

it('rejects Git internals in mixed case', () => {
  expect(Schema.is(relativePathSchema)('sub/.GIT/config')).toBe(false);
});

it('rejects a lone surrogate', () => {
  expect(Schema.is(relativePathSchema)('a\ud800.ts')).toBe(false);
});

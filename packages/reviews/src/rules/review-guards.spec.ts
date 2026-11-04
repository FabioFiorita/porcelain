import { expect, it } from 'vitest';
import { reviewGuards } from './review-guards.ts';
it('lists added guard files without calling edited or removed guards new', () => {
  const file = (path: string, status: 'added' | 'modified' | 'deleted') => ({
    path,
    status,
    oldMode: '100644',
    newMode: '100644',
  });
  const files = [
    file('architecture/new-rule.mjs', 'added'),
    file('eslint.config.js', 'modified'),
    file('architecture/old.mjs', 'deleted'),
    file('src/view.ts', 'added'),
  ];
  expect(reviewGuards(files)).toEqual(['architecture/new-rule.mjs']);
});

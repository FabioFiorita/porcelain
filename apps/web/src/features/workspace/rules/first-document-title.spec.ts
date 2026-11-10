import { expect, it } from 'vitest';
import { releaseTitle } from './first-document-title.ts';

it('keeps the newer title when an older owner releases after it was replaced', () => {
  const writing = Symbol();
  const written = Symbol();
  const current = { owner: written, title: 'Add notes' };
  expect(releaseTitle(current, writing)).toBe(current);
  expect(releaseTitle(current, written)).toBeUndefined();
});

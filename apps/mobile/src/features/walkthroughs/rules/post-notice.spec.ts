import { expect, it } from 'vitest';
import { copiedNotice, stillSavedNotice } from './post-notice';

it('says how many comments stayed saved without repeating their text', () => {
  expect(stillSavedNotice(1).text).toBe(
    'One comment is still saved: it belongs to a different repository.',
  );
  expect(stillSavedNotice(2).text).toBe(
    '2 comments are still saved: they belong to a different repository.',
  );
});

it('confirms a copied brief in one short line, never the brief itself', () => {
  expect(copiedNotice(true)).toEqual({ text: 'Copied brief', copy: false });
  expect(copiedNotice(false).text).toBe('Could not copy the brief.');
});

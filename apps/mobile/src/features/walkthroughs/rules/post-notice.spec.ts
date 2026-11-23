import { expect, it } from 'vite-plus/test';
import { stillSavedNotice } from './post-notice';

it('says how many comments stayed saved without repeating their text', () => {
  expect(stillSavedNotice(1).text).toBe(
    'One comment is still saved: it belongs to a different repository.',
  );
  expect(stillSavedNotice(2).text).toBe(
    '2 comments are still saved: they belong to a different repository.',
  );
});

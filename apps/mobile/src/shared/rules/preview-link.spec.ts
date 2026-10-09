import { expect, it } from 'vitest';
import { isPreviewLink } from './preview-link';

it('only forwards web and email links, including mixed-case schemes', () => {
  expect(
    [
      'http://example.com',
      'https://example.com/docs?q=x',
      'MAILTO:dev@example.com',
    ].map(isPreviewLink),
  ).toEqual([true, true, true]);
  expect(
    [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,x',
      'porcelain://settings',
      '//example.com',
      '/relative',
      'broken',
      'https:',
    ].map(isPreviewLink),
  ).toEqual([false, false, false, false, false, false, false, false]);
});

import { expect, it } from 'vitest';
import { externalLink } from './external-link.ts';
it.each([
  'http://example.com',
  'https://example.com/docs?q=x',
  'MAILTO:dev@example.com',
])('allows ordinary web and mail links: %s', (url) => {
  expect(externalLink(url)).toEqual(true);
});
it.each([
  'javascript:alert(1)',
  'file:///etc/passwd',
  'data:text/html,x',
  'porcelain://settings',
  '//example.com',
  '/relative',
  'broken',
  'https:',
  'https://owner:secret@example.com',
  'http://owner@example.com',
  'mailto://owner:secret@example.com',
])('refuses unsafe schemes, relative URLs and credentials: %s', (url) => {
  expect(externalLink(url)).toBe(false);
});

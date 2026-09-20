import { expect, it } from 'vitest';
import { deriveProjectName } from './project-name.ts';

const checkout = '/home/owner/code/checkout-folder';

it.each([
  ['git@github.com:owner/porcelain.git', 'porcelain'],
  ['https://github.com/owner/porcelain.git', 'porcelain'],
  ['https://github.com/owner/porcelain', 'porcelain'],
  ['https://github.com/owner/porcelain/', 'porcelain'],
  ['ssh://git@example.invalid:2222/team/deep/porcelain.git', 'porcelain'],
  ['/srv/git/porcelain.git', 'porcelain'],
  ['git@example.invalid:porcelain', 'porcelain'],
])('names a project after the repository in %s', (origin, expected) => {
  expect(deriveProjectName(origin, checkout)).toBe(expected);
});

it.each([
  ['no origin at all', null],
  ['an empty remote', ''],
  ['a URL with no repository in it', 'https://github.com'],
  ['a remote that is only separators', '://'],
])('falls back to the checkout folder for %s', (_case, origin) => {
  // Not the folder containing the Git directory: a repository whose Git
  // directory lives elsewhere would otherwise be named after that.
  expect(deriveProjectName(origin, checkout)).toBe('checkout-folder');
});

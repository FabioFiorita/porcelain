import { expect, it } from 'vitest';
import { validateHttpsCredentialHelpers } from './validate-https-credential-helpers.ts';

const config = (...entries: [string, string][]) =>
  entries.map(([key, value]) => `${key}\n${value}`).join('\0');

it.each([
  [
    'credential.helper',
    '!f() { echo password=ghp_secret; }; f',
    'credential.helper',
  ],
  [
    'credential.https://user:ghp_secret@example.com/org.helper',
    'manager',
    'credential.https://example.com/org.helper',
  ],
  ['credential.ghp_secret.helper', 'manager', 'credential.<url>.helper'],
])('names %s without repeating a secret', (key, value, shown) => {
  let detail = '';
  try {
    validateHttpsCredentialHelpers(config([key, value]));
  } catch (error) {
    detail = (error as { detail: string }).detail;
  }
  expect(detail).toContain(`\`${shown}\``);
  expect(detail).not.toContain('ghp_secret');
});

it('accepts the cache and store helpers after an explicit reset', () => {
  expect(() =>
    validateHttpsCredentialHelpers(
      config(
        ['credential.helper', 'osxkeychain'],
        ['credential.helper', ''],
        ['credential.helper', 'store'],
      ),
    ),
  ).not.toThrow();
});

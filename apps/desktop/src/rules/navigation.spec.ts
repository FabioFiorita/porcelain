import { describe, expect, it } from 'vitest';
import { localNavigation, externalNavigation } from './navigation.ts';

describe('desktop navigation', () => {
  it('keeps the window inside its own local server origin', () => {
    expect(
      localNavigation(
        'http://127.0.0.1:3000/project#review',
        'http://127.0.0.1:3000',
      ),
    ).toBe(true);
  });
  it.each([
    'http://127.0.0.1:3001/',
    'http://localhost:3000/',
    'https://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://owner:secret@127.0.0.1:3000/',
  ])('refuses a different origin or a credentialed navigation: %s', (url) => {
    expect(localNavigation(url, 'http://127.0.0.1:3000')).toBe(false);
  });
  it('permits an ordinary HTTPS link in the system browser', () => {
    expect(externalNavigation('https://github.com/electron/electron')).toBe(
      true,
    );
  });
  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://example.com',
    'https://owner:secret@example.com',
    'unparseable',
  ])('refuses an unsafe external link: %s', (url) => {
    expect(externalNavigation(url)).toBe(false);
  });
});

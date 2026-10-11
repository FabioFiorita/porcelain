import { describe, expect, it } from 'vitest';
import { appDocument, localNavigation } from './navigation.ts';

describe('desktop navigation', () => {
  it('recognises the desktop origin even though Node represents custom origins as opaque', () => {
    expect(
      localNavigation('porcelain://app/project#review', 'porcelain://app'),
    ).toBe(true);
  });
  it.each([
    'porcelain://elsewhere/',
    'file:///app',
    'porcelain://app:3000/',
    'porcelain://owner:secret@app/',
    'https://app/',
    'porcelain://app.evil/',
  ])('refuses a different desktop authority: %s', (url) => {
    expect(localNavigation(url, 'porcelain://app')).toBe(false);
  });
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
});

describe('appDocument', () => {
  it.each(['porcelain://app/', 'porcelain://app/remotes/computer/p/w?entry=x'])(
    'is the app itself: %s',
    (url) => {
      expect(appDocument(url)).toBe(true);
    },
  );
  it.each([
    'porcelain://app/review-summaries/token?expires=x&signature=y',
    'porcelain://app/remote-review-summaries/token?computer=http://evil.example',
    'porcelain://elsewhere/',
    'https://evil.example/',
    'unparseable',
  ])('is not the app when it shows a summary or another origin: %s', (url) => {
    expect(appDocument(url)).toBe(false);
  });
});

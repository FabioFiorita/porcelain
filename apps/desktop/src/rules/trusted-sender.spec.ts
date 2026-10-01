import { describe, expect, it } from 'vitest';
import { trustedSender } from './trusted-sender.ts';

describe('trustedSender', () => {
  const contents = { id: 1 };
  const mainFrame = { name: 'main' };
  const app = { contents, mainFrame };

  it('trusts the main frame of the app window while it shows the app', () => {
    expect(
      trustedSender(
        { contents, frame: mainFrame, url: 'porcelain://app/settings' },
        app,
      ),
    ).toBe(true);
  });

  it('trusts nobody while the app window is closed', () => {
    expect(
      trustedSender(
        { contents, frame: mainFrame, url: 'porcelain://app/' },
        undefined,
      ),
    ).toBe(false);
  });

  it('refuses another window, even one that loaded the preload', () => {
    expect(
      trustedSender(
        { contents: { id: 2 }, frame: mainFrame, url: 'porcelain://app/' },
        app,
      ),
    ).toBe(false);
  });

  it('refuses a frame inside the app window, such as a review summary', () => {
    expect(
      trustedSender(
        {
          contents,
          frame: { name: 'summary' },
          url: 'porcelain://app/review-summaries/token',
        },
        app,
      ),
    ).toBe(false);
  });

  it('refuses a sender whose frame is gone', () => {
    expect(trustedSender({ contents, frame: null, url: undefined }, app)).toBe(
      false,
    );
  });

  it.each([
    'https://evil.example/',
    'data:text/html,<title>x</title>',
    'porcelain://app/review-summaries/token?expires=x&signature=y',
    'porcelain://app/remote-review-summaries/token?computer=http://evil.example',
  ])('refuses the app window once it shows another document: %s', (url) => {
    expect(trustedSender({ contents, frame: mainFrame, url }, app)).toBe(false);
  });
});

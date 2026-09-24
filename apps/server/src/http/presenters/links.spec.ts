import { describe, expect, it } from 'vitest';
import { pairLink, summaryLink } from './links.ts';

describe('summaryLink', () => {
  it('points at the summary page with the expiry and signature of its grant', () => {
    expect(
      summaryLink({
        token: 'token',
        expires: '2026-09-24T12:00:00.000Z',
        signature: 'signed',
      }),
    ).toBe(
      '/review-summaries/token?expires=2026-09-24T12%3A00%3A00.000Z&signature=signed',
    );
  });

  it('keeps a token with reserved characters inside its own path segment', () => {
    const link = summaryLink({ token: 'a/b?c', expires: 'e', signature: 's' });
    expect(new URL(link, 'http://porcelain.test').pathname).toBe(
      '/review-summaries/a%2Fb%3Fc',
    );
  });
});

describe('pairLink', () => {
  it('opens the pairing page of the first address with the code and environment in the fragment', () => {
    expect(
      pairLink({
        addresses: ['http://host.test:3000'],
        code: 'pcode',
        environmentId: 'env',
      }),
    ).toBe('http://host.test:3000/pair#c=pcode&e=env');
  });

  it('lists every address in the fragment when the grant names several', () => {
    const link = new URL(
      pairLink({
        addresses: ['http://one.test', 'http://two.test'],
        code: 'pcode',
        environmentId: 'env',
      }),
    );
    expect(new URLSearchParams(link.hash.slice(1)).get('a')).toBe(
      'http://one.test,http://two.test',
    );
  });
});

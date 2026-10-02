import { describe, expect, it } from 'vitest';
import {
  remoteSummaryHeaders,
  remoteSummaryRequest,
  remoteSummaryTarget,
} from './remote-summary.ts';

const token = '4f0a5c2e-8a43-4d4f-9b44-0f1f4ad5d0a1';
const signature = 'a'.repeat(43);
const expires = '2026-10-01T00:00:00.000Z';
const published = `http://192.168.1.20:4738/review-summaries/${token}?expires=2026-10-01T00%3A00%3A00.000Z&signature=${signature}`;

function proxied(computer: string, path = `/remote-review-summaries/${token}`) {
  const query = new URLSearchParams({ computer, expires, signature });
  return `porcelain://app${path}?${query.toString()}`;
}

describe('remoteSummaryRequest', () => {
  it('recognises a remote summary the app frames', () => {
    expect(remoteSummaryRequest(`/remote-review-summaries/${token}`)).toBe(
      true,
    );
  });

  it('leaves local summaries and app pages to the local server', () => {
    expect(
      [`/review-summaries/${token}`, '/', '/api/inventory'].map(
        remoteSummaryRequest,
      ),
    ).toEqual([false, false, false]);
  });
});

describe('remoteSummaryTarget', () => {
  it('reads the signed summary from the computer that published it', () => {
    expect(remoteSummaryTarget(proxied('http://192.168.1.20:4738'))).toBe(
      `http://192.168.1.20:4738/review-summaries/${token}?expires=2026-10-01T00%3A00%3A00.000Z&signature=${signature}`,
    );
  });

  it('reads from an HTTPS computer too', () => {
    expect(
      remoteSummaryTarget(proxied('https://computer.example.invalid')),
    ).toBe(
      `https://computer.example.invalid/review-summaries/${token}?expires=2026-10-01T00%3A00%3A00.000Z&signature=${signature}`,
    );
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'porcelain://app',
    'http://owner:secret@192.168.1.20:4738',
    'http://192.168.1.20:4738/api/inventory',
    'http://192.168.1.20:4738/?next=x',
    'not a computer',
  ])('refuses a computer that is not a bare HTTP origin: %s', (computer) => {
    expect(remoteSummaryTarget(proxied(computer))).toBeUndefined();
    expect(remoteSummaryTarget(proxied('http://192.168.1.20:4738'))).toBe(
      published,
    );
  });

  it.each([
    '/remote-review-summaries/%2e%2e',
    '/remote-review-summaries/token/../../api/inventory',
    `/remote-review-summaries/${token}/extra`,
    '/remote-review-summaries/',
  ])('reads only a summary token, never another path: %s', (path) => {
    expect(
      remoteSummaryTarget(proxied('http://192.168.1.20:4738', path)),
    ).toBeUndefined();
    expect(
      remoteSummaryTarget(
        proxied(
          'http://192.168.1.20:4738',
          `/remote-review-summaries/${token}`,
        ),
      ),
    ).toBe(published);
  });

  it('refuses a link without its expiry or signature', () => {
    expect(
      remoteSummaryTarget(
        `porcelain://app/remote-review-summaries/${token}?computer=http://192.168.1.20:4738`,
      ),
    ).toBeUndefined();
    expect(
      remoteSummaryTarget(
        `porcelain://app/remote-review-summaries/${token}?computer=http://192.168.1.20:4738&expires=${expires}&signature=${signature}`,
      ),
    ).toBe(published);
  });
});

describe('remoteSummaryHeaders', () => {
  it('sandboxes the summary whatever policy the computer sent, and keeps it out of caches and referrers', () => {
    const headers = remoteSummaryHeaders(
      new Headers({
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src *; script-src 'unsafe-inline'",
        'set-cookie': 'tracker=1',
        location: 'https://evil.example/',
      }),
    );
    expect(Object.fromEntries(headers)).toEqual({
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        'sandbox allow-scripts allow-forms allow-popups allow-modals',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    });
  });

  it('shows anything but HTML as plain text', () => {
    expect(
      remoteSummaryHeaders(
        new Headers({ 'content-type': 'image/svg+xml' }),
      ).get('content-type'),
    ).toBe('text/plain; charset=utf-8');
  });
});

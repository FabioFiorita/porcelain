import { expect, it } from 'vitest';
import {
  parseReviewAppLink,
  parseDesktopReviewLink,
  reviewDesktopUrl,
  notificationReviewRoute,
} from './app-link.ts';

const reviewId = '10000000-0000-4000-8000-000000000001';
const decision = '20000000-0000-4000-8000-000000000002';
const path = `/open/reviews/${reviewId}`;
const link = `${path}?environment=computer&host=computer.example.com:8443`;

it('reads a revision and decision without losing the environment or port', () => {
  const result = parseReviewAppLink(
    `https://porcelain.fabiofiorita.com${link}&revision=3&decision=${decision}`,
  );
  expect(result).toMatchObject({
    reviewId,
    environmentId: 'computer',
    host: 'computer.example.com:8443',
    revision: 3,
    decision,
  });
  expect(result?.webUrl).toBe(
    `https://computer.example.com:8443/reviews/${reviewId}/3/decisions/${decision}`,
  );
});
it.each(['computer.example.com', '100.64.1.2:1234', '[::1]:1234'])(
  'opens the latest review on %s',
  (host) => {
    const result = parseReviewAppLink(
      `${path}?environment=computer&host=${encodeURIComponent(host)}`,
    );
    expect(result).toMatchObject({ reviewId, environmentId: 'computer', host });
    expect(result?.webUrl).toBe(`https://${host}/reviews/${reviewId}`);
  },
);
it('preserves a decision on the latest revision without inventing a revision number', () => {
  const result = parseReviewAppLink(`${link}&decision=${decision}`);
  expect(result).toMatchObject({
    reviewId,
    environmentId: 'computer',
    host: 'computer.example.com:8443',
    decision,
  });
  expect(result?.webUrl).toBe(
    `https://computer.example.com:8443/reviews/${reviewId}?decision=${decision}`,
  );
});
it.each([
  'https://evil.com',
  'owner:secret@evil.com',
  'evil.com/path',
  'evil.com?x=y',
  '//evil.com',
  'evil.com#x',
  'evil.com\\path',
  'evil.com%2fpath',
  ' evil.com',
  'evil.com:65536',
  'evil.com:0',
  'evil.com:abc',
  'evil..com',
])('rejects an unsafe host %s', (host) => {
  expect(
    parseReviewAppLink(
      `${path}?environment=computer&host=${encodeURIComponent(host)}`,
    ),
  ).toBeUndefined();
});
it.each([
  '&revision=0',
  '&revision=-1',
  '&revision=1.5',
  '&revision=1e2',
  '&revision=9007199254740992',
  '&decision=../settings',
  '&host=second.com',
  '&environment=second',
  '&revision=3&revision=4',
  `&decision=${decision}&decision=${decision}`,
  '#fragment',
])('rejects an ambiguous or invalid destination %s', (query) => {
  expect(parseReviewAppLink(`${link}${query}`)).toBeUndefined();
});
it.each([
  `https://evil.com${link}`,
  `https://user@porcelain.fabiofiorita.com${link}`,
  `${path}/extra?environment=x&host=host`,
  `${path}?host=host`,
  `${path}?environment=&host=host`,
  '/open/reviews/not-a-review?environment=x&host=host',
])('rejects invalid links %s', (value) => {
  expect(parseReviewAppLink(value)).toBeUndefined();
});

it.each([
  ['http', '127.0.0.1:5090'],
  ['http', '192.168.1.2:5090'],
  ['http', '[::1]:5090'],
  ['http', 'localhost:80'],
  ['https', 'machine.ts.net:8443'],
  ['https', 'computer.example.com:443'],
])('retains the explicit %s protocol for %s', (protocol, host) => {
  const result = parseReviewAppLink(
    `${path}?environment=computer&host=${encodeURIComponent(host)}&protocol=${protocol}&revision=3&decision=${decision}`,
  );
  expect(result).toMatchObject({
    environmentId: 'computer',
    reviewId,
    revision: 3,
    decision,
    host,
    protocol,
  });
  expect(result?.webUrl).toBe(
    new URL(
      `${protocol}://${host}/reviews/${reviewId}/3/decisions/${decision}`,
    ).toString(),
  );
});
it.each(['ftp', 'javascript', 'https:', '', 'http&protocol=https'])(
  'rejects an invalid or duplicate protocol %s',
  (protocol) => {
    expect(parseReviewAppLink(`${link}&protocol=${protocol}`)).toBeUndefined();
  },
);
it.each([
  'owner:secret@evil.com',
  'evil.com/path',
  'evil.com:0',
  'evil.com:65536',
  ' evil.com',
  'evil.com\\path',
  'evil.com?x=y',
])('preserves unsafe host rejection with HTTP: %s', (host) => {
  expect(
    parseReviewAppLink(
      `${path}?environment=computer&host=${encodeURIComponent(host)}&protocol=http`,
    ),
  ).toBeUndefined();
});

it.each(['&future=value', '&future=one&future=two', '&token=secret'])(
  'ignores unknown query keys %s',
  (query) => {
    expect(parseReviewAppLink(`${link}&revision=3${query}`)).toEqual({
      reviewId,
      environmentId: 'computer',
      host: 'computer.example.com:8443',
      revision: 3,
      webUrl: `https://computer.example.com:8443/reviews/${reviewId}/3`,
    });
  },
);
it('reads the current server publication link', () => {
  expect(
    parseReviewAppLink(
      'https://porcelain.fabiofiorita.com/open/reviews/b50dcb25-8d72-4c8b-8984-1f74c9423a77?environment=1bc3e6b1-f849-4176-93b2-850147d4ebb3&host=porcelain-beelink.fabiofiorita.com&protocol=https&revision=3',
    ),
  ).toEqual({
    reviewId: 'b50dcb25-8d72-4c8b-8984-1f74c9423a77',
    environmentId: '1bc3e6b1-f849-4176-93b2-850147d4ebb3',
    host: 'porcelain-beelink.fabiofiorita.com',
    protocol: 'https',
    revision: 3,
    webUrl:
      'https://porcelain-beelink.fabiofiorita.com/reviews/b50dcb25-8d72-4c8b-8984-1f74c9423a77/3',
  });
});

it('round-trips a desktop handoff without losing the host, HTTP, environment, revision or decision', () => {
  const url = `porcelain-desktop://open/reviews/${reviewId}?environment=computer&host=localhost%3A5090&protocol=http&revision=3&decision=${decision}`;
  const parsed = parseDesktopReviewLink(url);
  expect(parsed).toEqual({
    reviewId,
    environmentId: 'computer',
    host: 'localhost:5090',
    protocol: 'http',
    revision: 3,
    decision,
    webUrl: `http://localhost:5090/reviews/${reviewId}/3/decisions/${decision}`,
  });
  expect(parsed && reviewDesktopUrl(parsed)).toBe(url);
});
it('ignores future desktop handoff parameters without forwarding them', () => {
  const parsed = parseDesktopReviewLink(
    `porcelain-desktop://open/reviews/${reviewId}?environment=computer&host=computer.example.com&future=one&future=two`,
  );
  expect(parsed?.webUrl).toBe(
    `https://computer.example.com/reviews/${reviewId}`,
  );
  expect(parsed && reviewDesktopUrl(parsed)).toBe(
    `porcelain-desktop://open/reviews/${reviewId}?environment=computer&host=computer.example.com`,
  );
});
it.each([
  `porcelain://open/reviews/${reviewId}?environment=x&host=host`,
  `porcelain-desktop://app/reviews/${reviewId}?environment=x&host=host`,
  `porcelain-desktop://user:password@open/reviews/${reviewId}?environment=x&host=host`,
  `porcelain-desktop://open:443/reviews/${reviewId}?environment=x&host=host`,
  `porcelain-desktop://open/reviews/${reviewId}?environment=x&host=host#fragment`,
  `porcelain-desktop://open/reviews/${reviewId}?environment=x&host=host&host=evil.com`,
  `porcelain-desktop://open/reviews/${reviewId}?environment=x&host=host&protocol=ftp`,
  `porcelain-desktop://open/reviews/${reviewId}?environment=x&host=host&revision=0`,
  `porcelain-desktop://open/settings?environment=x&host=host`,
  `https://open/reviews/${reviewId}?environment=x&host=host`,
])('rejects an invalid desktop handoff %s', (url) => {
  expect(parseDesktopReviewLink(url)).toBeUndefined();
});

it('opens the review a notification links to, inside the app', () => {
  expect(
    notificationReviewRoute({
      kind: 'review-ready',
      url: `https://porcelain.fabiofiorita.com${path}?environment=env&host=10.0.2.2%3A4100&protocol=http`,
    }),
  ).toBe(`${path}?environment=env&host=10.0.2.2%3A4100&protocol=http`);
});

it.each([
  { case: 'no link', data: { kind: 'agent-reply' } },
  { case: 'a foreign link', data: { url: `https://example.com${path}` } },
  { case: 'no data', data: null },
])('opens Reviews for a notification with $case', ({ data }) => {
  expect(notificationReviewRoute(data)).toBe('/');
});

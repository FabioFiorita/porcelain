import { expect, it } from 'vitest';
import { parseReviewAppLink } from './app-link.ts';

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
  '&token=secret',
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

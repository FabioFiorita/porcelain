import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import {
  literally,
  read,
  sampleReview,
  sampleSummaryHtml,
  worktreePath,
} from '../scripts/fixture.ts';

async function summaryUrl(session: Session) {
  const current = (
    await read(session, {
      method: 'GET',
      path: worktreePath(session, '/review'),
    })
  ).review;
  const revision = current === null ? 0 : Number(record(current).revision);
  const answer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, revision, randomUUID(), randomUUID()),
  });
  return new URL(
    String(record(record(answer.review).summary).url),
    session.address,
  );
}

export default defineFeature({
  feature: 'reviews.read-review-summary',
  reaches: 'GET /review-summaries/:token',
  paired: false,
  intent: 'observed',
  behaviour:
    'The published HTML summary is served outside the API at a signed, expiring link that needs no credential, so it can load in a sandboxed frame. The page is sent as published with a small theme and navigation bridge added before </body>, a sandbox content security policy, no caching and no referrer. Only the current summary is served. A wrong signature, a link whose expiry was changed, a link that has expired (the same link served before it expired) or the link of a replaced summary answers 404 with an empty body; a malformed link is invalid.',
  cases: [
    defineCase({
      name: 'signed link',
      setup: summaryUrl,
      request: (_session, url) => ({
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        auth: 'none',
      }),
      expect({ response, check, checkMatch }) {
        check('status', 200, response.status);
        check(
          'content type',
          'text/html; charset=utf-8',
          response.headers['content-type'],
        );
        check(
          'sandboxed',
          'sandbox allow-scripts allow-forms allow-popups allow-modals',
          response.headers['content-security-policy'],
        );
        check(
          'not cached',
          'private, no-store',
          response.headers['cache-control'],
        );
        check(
          'no referrer',
          'no-referrer',
          response.headers['referrer-policy'],
        );
        const html = text(response.body);
        const [published = '', closing = ''] =
          sampleSummaryHtml.split('</body>');
        const opening = `${published}<style id="porcelain-theme">`;
        const ending = `</script></body>${closing}`;
        checkMatch(
          'the published page opens, then the bridge begins',
          new RegExp(`^${literally(opening)}`),
          html,
        );
        checkMatch(
          'the bridge ends before </body>',
          new RegExp(`${literally(ending)}$`),
          html,
        );
      },
    }),
    defineCase({
      name: 'a wrong signature or a tampered expiry',
      setup: summaryUrl,
      request: (_session, url) => [
        {
          method: 'GET',
          path: `${url.pathname}?expires=${url.searchParams.get('expires')}&signature=${'A'.repeat(43)}`,
          auth: 'none',
        },
        {
          method: 'GET',
          path: `${url.pathname}?expires=${encodeURIComponent('2020-01-01T00:00:00.000Z')}&signature=${url.searchParams.get('signature')}`,
          auth: 'none',
        },
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [404, 404],
          responses.map((entry) => entry.status),
        );
        check(
          'empty bodies',
          [undefined, undefined],
          responses.map((entry) => entry.body),
        );
      },
    }),
    defineCase({
      name: 'an expired link',
      async setup(session) {
        const url = await summaryUrl(session);
        const link = {
          method: 'GET' as const,
          path: `${url.pathname}${url.search}`,
          auth: 'none' as const,
        };
        await session.read(link);
        const expires = Date.parse(text(url.searchParams.get('expires')));
        await delay(Math.max(0, expires - Date.now()) + 100);
        return link;
      },
      request: (_session, link) => link,
      expect({ response, check }) {
        check('status', 404, response.status);
        check('empty body', undefined, response.body);
      },
    }),
    defineCase({
      name: 'the link of a replaced summary',
      async setup(session) {
        const replaced = await summaryUrl(session);
        await summaryUrl(session);
        return replaced;
      },
      request: (_session, url) => ({
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        auth: 'none',
      }),
      expect({ response, check }) {
        check('status', 404, response.status);
        check('empty body', undefined, response.body);
      },
    }),
    defineCase({
      name: 'malformed link',
      setup: summaryUrl,
      request: (_session, url) => [
        { method: 'GET', path: url.pathname, auth: 'none' },
        {
          method: 'GET',
          path: `/review-summaries/not-a-token${url.search}`,
          auth: 'none',
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
  ],
});

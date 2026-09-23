import { apiError, defineCase, defineFeature } from '../scripts/feature.ts';
import { issuePairing } from '../scripts/fixture.ts';

const limited = apiError(
  429,
  'Too Many Requests',
  'Too many pairing attempts. Wait a moment and try again.',
);

export default defineFeature({
  feature: 'access.pairing-limit',
  reaches: 'POST /api/pair',
  intent: 'observed',
  behaviour:
    'Pairing attempts are rate limited per peer: ten failed redemptions within a minute exhaust the allowance and further attempts are refused, even with a valid code, until it refills. Successful redemptions give their attempt back. Runs on its own server so the limit starts full.',
  cases: [
    defineCase({
      name: 'failed attempts exhaust the allowance',
      request: () =>
        Array.from({ length: 11 }, () => ({
          method: 'POST' as const,
          path: '/api/pair',
          auth: 'none' as const,
          body: { code: 'pcp_wrong', platform: 'iOS' },
        })),
      expect({ responses, check }) {
        check(
          'first ten are refused as invalid',
          Array(10).fill(401),
          responses.slice(0, 10).map((entry) => entry.status),
        );
        check('eleventh status', 429, responses[10]?.status);
        check('eleventh error body', limited, responses[10]?.body);
      },
    }),
    defineCase({
      name: 'a valid code is limited too',
      setup: (session) => issuePairing(session),
      request: (_session, code) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        body: { code, platform: 'iOS' },
      }),
      expect({ response, check }) {
        check('status', 429, response.status);
        check('error body', limited, response.body);
      },
    }),
  ],
});

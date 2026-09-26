import {
  apiError,
  defineCase,
  defineFeature,
  record,
  type HttpRequest,
} from '../scripts/feature.ts';
import { issuePairing } from '../scripts/fixture.ts';

const limited = apiError(
  429,
  'Too Many Requests',
  'Too many pairing attempts. Wait a moment and try again.',
);
const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);
const attempt = (code: string): HttpRequest => ({
  method: 'POST',
  path: '/api/pair',
  auth: 'none',
  body: { code, platform: 'iOS' },
});

export default defineFeature({
  feature: 'access.pairing-limit',
  reaches: 'POST /api/pair',
  paired: false,
  intent: 'observed',
  behaviour:
    'Pairing attempts are rate limited per peer: ten attempts within a minute exhaust the allowance and further attempts are refused, even with a valid code, until it refills. A successful redemption gives its attempt back, so only failed attempts count. Runs on its own server so the limit starts full.',
  cases: [
    defineCase({
      name: 'a success gives its attempt back and ten failures exhaust the allowance',
      setup: (session) => issuePairing(session, 'Phone'),
      request: (_session, code) => [
        ...Array.from({ length: 9 }, () => attempt('pcp_wrong')),
        attempt(code),
        attempt('pcp_wrong'),
        attempt('pcp_wrong'),
      ],
      expect({ responses, check, checkPartial }) {
        for (const [index, response] of responses.slice(0, 9).entries()) {
          check(`failure ${index + 1} status`, 401, response.status);
          check(`failure ${index + 1} error body`, invalidLink, response.body);
        }
        check('the valid code redeems', 200, responses[9]?.status);
        checkPartial(
          'the redeemed device',
          { label: 'Phone', platform: 'iOS' },
          record(responses[9]?.body).device,
        );
        check('tenth failure status', 401, responses[10]?.status);
        check('tenth failure error body', invalidLink, responses[10]?.body);
        check('the next attempt status', 429, responses[11]?.status);
        check('the next attempt error body', limited, responses[11]?.body);
      },
    }),
    defineCase({
      name: 'a valid code is limited too',
      setup: (session) => issuePairing(session),
      request: (_session, code) => attempt(code),
      expect({ response, check }) {
        check('status', 429, response.status);
        check('error body', limited, response.body);
      },
    }),
  ],
});

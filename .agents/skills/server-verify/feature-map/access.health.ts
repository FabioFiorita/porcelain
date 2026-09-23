import { readHealthResponseSchema } from '../../../../packages/contracts/src/access/index.ts';
import { defineCase, defineFeature } from '../scripts/feature.ts';
import { inventory } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'access.health',
  reaches: 'GET /api/health',
  intent: 'observed',
  behaviour:
    "Anyone who can reach the server can ask whether it is up, without pairing. The answer names the server's environment, the same one paired reads report.",
  cases: [
    defineCase({
      name: 'without a credential',
      setup: inventory,
      request: () => ({ method: 'GET', path: '/api/health', auth: 'none' }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'body',
          { status: 'ok', environmentId: state.environmentId },
          response.body,
        );
        checkContract('contract', readHealthResponseSchema, response.body);
      },
    }),
    defineCase({
      name: 'with a credential the server does not know',
      request: () => ({
        method: 'GET',
        path: '/api/health',
        auth: { bearer: 'pcd_not-a-device' },
      }),
      expect({ response, checkPartial }) {
        checkPartial(
          'health ignores credentials',
          { status: 'ok' },
          response.body,
        );
      },
    }),
  ],
});

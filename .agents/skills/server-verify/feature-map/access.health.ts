import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { defineCase, defineFeature } from '../scripts/feature.ts';
import { inventory, pairDevice } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'access.health',
  reaches: 'GET /api/health',
  paired: false,
  intent: 'observed',
  behaviour:
    "Anyone who can reach the server can ask whether it is up, without pairing. The answer names the server's environment, the same one paired reads report. Health never authenticates, so an unknown or revoked credential is ignored rather than refused; it has no failure answer of its own.",
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
      name: 'with a credential the server does not know or has revoked',
      async setup(session) {
        const device = await pairDevice(session, 'Revoked device');
        await session.read({
          method: 'POST',
          path: '/access/revoke',
          target: 'owner',
          body: { id: device.deviceId },
        });
        return {
          credential: device.credential,
          environmentId: (await inventory(session)).environmentId,
        };
      },
      request: (_session, state) => [
        {
          method: 'GET',
          path: '/api/health',
          auth: { bearer: 'pcd_not-a-device' },
        },
        {
          method: 'GET',
          path: '/api/health',
          auth: { bearer: state.credential },
        },
      ],
      expect({ responses, state, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 200, response.status);
          check(
            `request ${index + 1} body`,
            { status: 'ok', environmentId: state.environmentId },
            response.body,
          );
        }
      },
    }),
  ],
});

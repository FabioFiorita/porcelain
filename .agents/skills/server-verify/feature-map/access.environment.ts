import { readEnvironmentResponseSchema } from '@porcelain/contracts/access';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { defineCase, defineFeature } from '../scripts/feature.ts';
import { record } from '../../../../apps/server/spec/kit/session.ts';
import { inventory } from '../scripts/fixture.ts';
import { read } from '../../../../apps/server/spec/kit/requests.ts';

const describe = { method: 'GET' as const, path: '/api/environment' };

async function known(session: Parameters<typeof inventory>[0]) {
  const listed = await inventory(session);
  const update = await read(session, {
    method: 'GET',
    path: '/api/service/update',
  });
  return {
    environmentId: listed.environmentId,
    name: record(listed.environment).name,
    version: update.version,
  };
}

export default defineFeature({
  feature: 'access.environment',
  reaches: 'GET /api/environment',
  paired: false,
  intent: 'intended',
  behaviour:
    "Anyone who can reach the server can ask which environment it is before pairing: its stable environment ID, its name, the version of Porcelain it runs and the protocol number a client checks before it trusts the answers. A client pins the environment ID it paired with and compares it on every connect, so the ID is the one the inventory reports and never changes, while the name follows the owner's choice. The descriptor never authenticates: an unknown credential is ignored rather than refused.",
  cases: [
    defineCase({
      name: 'without a credential',
      setup: known,
      request: () => ({ ...describe, auth: 'none' }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readEnvironmentResponseSchema, response.body);
        check(
          'body',
          {
            environmentId: state.environmentId,
            name: state.name,
            version: state.version,
            protocol: ENVIRONMENT_PROTOCOL,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'the name follows a rename and the ID stays',
      setup: known,
      request: () => [
        {
          method: 'PUT',
          path: '/api/environment/name',
          body: { name: 'Headless box' },
        },
        { ...describe, auth: { bearer: 'pcd_not-a-device' } },
      ],
      expect({ responses, state, check }) {
        const [renamed, described] = responses;
        check('rename status', 200, renamed?.status);
        check('renamed', { name: 'Headless box', custom: true }, renamed?.body);
        check('status', 200, described?.status);
        check(
          'body',
          {
            environmentId: state.environmentId,
            name: 'Headless box',
            version: state.version,
            protocol: ENVIRONMENT_PROTOCOL,
          },
          described?.body,
        );
      },
    }),
  ],
});

import { renameEnvironmentResponseSchema } from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import { inventory, watching } from '../scripts/fixture.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const rename = (name: unknown, headers?: Record<string, string>) => ({
  method: 'PUT' as const,
  path: '/api/environment/name',
  body: { name },
  ...(headers ? { headers } : {}),
});
const environment = async (session: Session) =>
  record((await inventory(session)).environment);

export default defineFeature({
  feature: 'access.environment-name',
  reaches: 'PUT /api/environment/name',
  paired: true,
  intent: 'intended',
  behaviour:
    "The inventory names the environment, so every paired device knows which computer it is connected to. Until the owner chooses a name it is the computer's host name. A paired browser on the computer that runs Porcelain renames it, with the surrounding spaces trimmed, or clears the name to go back to the host name; the inventory then answers the new name and live viewers are told the inventory changed. A blank, overlong or control-character name is invalid, and a request that did not come from this computer's loopback listener is refused, like Sharing.",
  cases: [
    defineCase({
      name: 'the environment is named after the host until the owner names it',
      request: () => ({ method: 'GET', path: '/api/inventory' }),
      expect({ response, check, checkPartial, checkContract, checkMatch }) {
        check('status', 200, response.status);
        checkContract('contract', readInventoryResponseSchema, response.body);
        checkPartial(
          'not chosen',
          { environment: { custom: false } },
          response.body,
        );
        checkMatch(
          'a host name',
          /\S/u,
          text(record(record(response.body).environment).name),
        );
      },
    }),
    defineCase({
      name: 'the owner names the environment and live viewers hear of it',
      setup: watching,
      request: () => rename('  Workstation  '),
      async expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          renameEnvironmentResponseSchema,
          response.body,
        );
        check(
          'the trimmed name',
          { name: 'Workstation', custom: true },
          response.body,
        );
        check(
          'the inventory answers it',
          { name: 'Workstation', custom: true },
          await environment(session),
        );
        check(
          'notice',
          { type: 'inventory' },
          await state.next((entry) => entry.type === 'inventory'),
        );
      },
    }),
    defineCase({
      name: 'clearing the name goes back to the host name',
      request: () => rename(null),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('not chosen', { custom: false }, response.body);
        check(
          'the inventory answers the same name',
          record(response.body),
          await environment(session),
        );
      },
    }),
    defineCase({
      name: 'a blank, overlong or control-character name is invalid',
      setup: environment,
      request: () => [
        rename('   '),
        rename('x'.repeat(65)),
        rename('Work\nstation'),
        { method: 'PUT', path: '/api/environment/name', body: {} },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(`request ${index + 1} body`, invalidRequest, response.body);
        }
        check('the name is unchanged', state, await environment(session));
      },
    }),
    defineCase({
      name: 'a relayed or remote request is refused',
      setup: environment,
      request: () => [
        rename('Intruder', { 'x-forwarded-for': '203.0.113.9' }),
        rename('Intruder', { 'cf-connecting-ip': '203.0.113.9' }),
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 403, response.status);
          check(`request ${index + 1} body`, notOnThisComputer, response.body);
        }
        check('the name is unchanged', state, await environment(session));
      },
    }),
  ],
});

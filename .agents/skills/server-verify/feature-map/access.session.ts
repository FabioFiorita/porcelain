import { readInventoryResponseSchema } from '../../../../packages/contracts/src/projects/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  record,
  unauthenticated,
} from '../scripts/feature.ts';
import { inventory, issuePairing } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'access.session',
  reaches: ['GET /api/session', 'DELETE /api/session'],
  intent: 'observed',
  behaviour:
    "A paired client, by bearer credential or by the browser's device cookie, reads the same inventory as `/api/inventory` from `/api/session`; without either it is refused. A browser clears its device cookie with `DELETE /api/session`, which requires the browser request header and does not revoke the device.",
  cases: [
    defineCase({
      name: 'bearer credential reads the inventory',
      setup: inventory,
      request: () => ({ method: 'GET', path: '/api/session' }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        check('same body as the inventory', state, response.body);
        checkContract('contract', readInventoryResponseSchema, response.body);
        check('not cacheable', 'no-store', response.headers['cache-control']);
      },
    }),
    defineCase({
      name: 'browser cookie reads the inventory',
      async setup(session) {
        const code = await issuePairing(session, 'Browser');
        const paired = await session.send({
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          headers: { 'x-porcelain-browser': '1' },
          body: { code, platform: 'Browser' },
        });
        const cookie = /porcelain_device=[^;]+/.exec(
          paired.headers['set-cookie'] ?? '',
        )?.[0];
        if (!cookie) throw new Error('Browser pairing set no device cookie');
        return { cookie, inventory: await inventory(session) };
      },
      request: (_session, state) => ({
        method: 'GET',
        path: '/api/session',
        auth: { cookie: state.cookie },
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check('same body as the inventory', state.inventory, response.body);
        check(
          'cookie is refreshed',
          true,
          (response.headers['set-cookie'] ?? '').startsWith(
            'porcelain_device=',
          ),
        );
      },
    }),
    defineCase({
      name: 'without a credential',
      request: () => ({ method: 'GET', path: '/api/session', auth: 'none' }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
        check('challenge', 'Bearer', response.headers['www-authenticate']);
      },
    }),
    defineCase({
      name: 'clearing without the browser header',
      request: () => ({ method: 'DELETE', path: '/api/session', auth: 'none' }),
      expect({ response, check }) {
        check('status', 403, response.status);
        check(
          'error body',
          apiError(403, 'Forbidden', 'Browser request header required'),
          response.body,
        );
        check('no cookie is set', undefined, response.headers['set-cookie']);
      },
    }),
    defineCase({
      name: 'clearing from a browser',
      request: () => ({
        method: 'DELETE',
        path: '/api/session',
        auth: 'none',
        headers: { 'x-porcelain-browser': '1' },
      }),
      async expect({ response, session, check }) {
        check('status', 204, response.status);
        check('empty body', undefined, response.body);
        check(
          'cookie is expired',
          'porcelain_device=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0',
          response.headers['set-cookie'],
        );
        const devices = list(
          record(
            (
              await session.send({
                method: 'GET',
                path: '/access',
                target: 'owner',
              })
            ).body,
          ).devices,
        );
        check('devices are not revoked', 2, devices.length);
      },
    }),
  ],
});

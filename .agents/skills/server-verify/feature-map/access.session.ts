import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  unauthenticated,
  type Session,
} from '../scripts/feature.ts';
import {
  deviceCookie,
  deviceCookieAttributes,
  inventory,
  issuePairing,
  read,
} from '../scripts/fixture.ts';

async function browserCookie(session: Session) {
  const code = await issuePairing(session, 'Browser');
  const paired = await session.read({
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
  return cookie;
}

async function devices(session: Session) {
  return list(
    (await read(session, { method: 'GET', path: '/access', target: 'owner' }))
      .devices,
  );
}

export default defineFeature({
  feature: 'access.session',
  reaches: ['GET /api/inventory', 'DELETE /api/session'],
  paired: false,
  intent: 'observed',
  behaviour:
    'A browser holds its pairing as an HttpOnly device cookie instead of a bearer credential. The cookie authenticates paired reads such as the inventory exactly as the bearer credential does, and each authenticated request refreshes it; a cookie the server does not know is refused. The browser clears its cookie with `DELETE /api/session`, which requires the browser request header and does not revoke the device.',
  cases: [
    defineCase({
      name: 'browser cookie reads the inventory',
      async setup(session) {
        return {
          cookie: await browserCookie(session),
          inventory: await inventory(session),
        };
      },
      request: (_session, state) => ({
        method: 'GET',
        path: '/api/inventory',
        auth: { cookie: state.cookie },
      }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        check('same body as the bearer read', state.inventory, response.body);
        checkContract('contract', readInventoryResponseSchema, response.body);
        check(
          'cookie is refreshed',
          { name: 'porcelain_device', attributes: deviceCookieAttributes },
          deviceCookie(response.headers['set-cookie']),
        );
      },
    }),
    defineCase({
      name: 'a cookie the server does not know',
      request: () => ({
        method: 'GET',
        path: '/api/inventory',
        auth: { cookie: 'porcelain_device=pcd_unknown' },
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
        check('no cookie is set', undefined, response.headers['set-cookie']);
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
      setup: devices,
      request: () => ({
        method: 'DELETE',
        path: '/api/session',
        auth: 'none',
        headers: { 'x-porcelain-browser': '1' },
      }),
      async expect({ response, state, session, check }) {
        check('status', 204, response.status);
        check('empty body', undefined, response.body);
        check(
          'cookie is expired',
          'porcelain_device=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0',
          response.headers['set-cookie'],
        );
        check('devices are not revoked', state, await devices(session));
      },
    }),
  ],
});

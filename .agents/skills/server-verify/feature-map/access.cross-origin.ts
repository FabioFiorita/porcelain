import {
  listAccessResponseSchema,
  readEnvironmentResponseSchema,
  readHealthResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  record,
  text,
  unauthenticated,
  type Session,
} from '../scripts/feature.ts';
import {
  credentialForm,
  inventory,
  issuePairing,
  read,
} from '../scripts/fixture.ts';

const app = 'http://app.example';
const fromApp = { origin: app };
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${app} cannot write here`,
);
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const projectPath = (session: Session) => `/api/projects/${session.projectId}`;
const rename = (
  session: Session,
  name: string,
  request: {
    headers?: Record<string, string>;
    auth?: 'none' | { bearer: string } | { cookie: string };
  },
) => ({
  method: 'PATCH' as const,
  path: projectPath(session),
  body: { name },
  ...request,
});
const projectName = async (session: Session) =>
  record(list((await inventory(session)).projects)[0]).name;

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

export default defineFeature({
  feature: 'access.cross-origin',
  reaches: [
    'GET /api/environment',
    'GET /api/inventory',
    'PATCH /api/projects/:projectId',
    'POST /api/pair',
    'GET /api/access',
    'POST /api/access/revoke',
  ],
  paired: false,
  intent: 'intended',
  behaviour:
    'An app served from another origin, such as the desktop app holding several environments, uses a server with the bearer credential it paired for. The API answers a CORS preflight that asks to send a bearer credential, or to redeem a pairing code, before any origin or credential check; it lets any origin read the answers to requests that carry a bearer credential and to pairing redemptions, and never allows credentials, so a device cookie never works across origins. A page on another origin gets no CORS headers for anything else, so it cannot read the public environment descriptor or health of a server on this computer. A request that carries a bearer credential may come from any origin, while a cookie-authenticated or unauthenticated write from another origin is refused exactly as before, and the Host allowlist still applies to everyone. A pairing code is redeemable from any origin, since the code is the secret: the credential comes back in the body, bound to the route the request reached, and a cross-origin redemption never sets a cookie. Sharing and device management stay with a browser on the computer that runs Porcelain.',
  cases: [
    defineCase({
      name: 'a preflight is answered before any origin or credential check',
      request: (session) => ({
        method: 'OPTIONS',
        path: projectPath(session),
        auth: 'none',
        headers: {
          origin: app,
          'access-control-request-method': 'PATCH',
          'access-control-request-headers': 'authorization, content-type',
        },
      }),
      expect({ response, check }) {
        check('status', 204, response.status);
        check('no body', undefined, response.body);
        check(
          'any origin',
          '*',
          response.headers['access-control-allow-origin'],
        );
        check(
          'the methods the API uses',
          'GET, HEAD, POST, PUT, PATCH, DELETE',
          response.headers['access-control-allow-methods'],
        );
        check(
          'the bearer and JSON headers',
          'authorization, content-type',
          response.headers['access-control-allow-headers'],
        );
        check(
          'cached for ten minutes',
          '600',
          response.headers['access-control-max-age'],
        );
        check(
          'credentials are never allowed',
          undefined,
          response.headers['access-control-allow-credentials'],
        );
      },
    }),
    defineCase({
      name: 'a page on another origin cannot read public answers, a bearer client can',
      request: () => [
        {
          method: 'GET',
          path: '/api/environment',
          headers: fromApp,
          auth: 'none',
        },
        { method: 'GET', path: '/api/health', headers: fromApp, auth: 'none' },
        { method: 'GET', path: '/api/environment', headers: fromApp },
        {
          method: 'OPTIONS',
          path: '/api/environment',
          auth: 'none',
          headers: { origin: app, 'access-control-request-method': 'GET' },
        },
      ],
      expect({ responses, check, checkContract }) {
        const [anonymous, health, bearer, preflight] = responses;
        check('anonymous status', 200, anonymous?.status);
        checkContract(
          'anonymous body',
          readEnvironmentResponseSchema,
          anonymous?.body,
        );
        check(
          'no CORS header without a bearer credential',
          undefined,
          anonymous?.headers['access-control-allow-origin'],
        );
        check('health status', 200, health?.status);
        checkContract('health body', readHealthResponseSchema, health?.body);
        check(
          'no CORS header on health',
          undefined,
          health?.headers['access-control-allow-origin'],
        );
        check('bearer status', 200, bearer?.status);
        check('bearer body', anonymous?.body, bearer?.body);
        check(
          'a bearer client reads it from any origin',
          '*',
          bearer?.headers['access-control-allow-origin'],
        );
        check('preflight without a bearer status', 404, preflight?.status);
        check(
          'preflight without a bearer body',
          apiError(
            404,
            'Not Found',
            'Route OPTIONS:/api/environment not found',
          ),
          preflight?.body,
        );
        check(
          'no CORS header on that preflight',
          undefined,
          preflight?.headers['access-control-allow-origin'],
        );
      },
    }),
    defineCase({
      name: 'a pairing redemption may be preflighted from another origin',
      request: () => ({
        method: 'OPTIONS',
        path: '/api/pair',
        auth: 'none',
        headers: {
          origin: app,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      }),
      expect({ response, check }) {
        check('status', 204, response.status);
        check('no body', undefined, response.body);
        check(
          'any origin',
          '*',
          response.headers['access-control-allow-origin'],
        );
        check(
          'credentials are never allowed',
          undefined,
          response.headers['access-control-allow-credentials'],
        );
      },
    }),
    defineCase({
      name: 'a bearer client on another origin reads and writes',
      setup: inventory,
      request: (session) => [
        { method: 'GET', path: '/api/inventory', headers: fromApp },
        rename(session, 'From the app', { headers: fromApp }),
        rename(session, 'From a file page', { headers: { origin: 'null' } }),
      ],
      async expect({ responses, state, session, check }) {
        const [listed, renamed, opaque] = responses;
        check('read status', 200, listed?.status);
        check('read body', state, listed?.body);
        check(
          'read is readable from any origin',
          '*',
          listed?.headers['access-control-allow-origin'],
        );
        check(
          'credentials are never allowed',
          undefined,
          listed?.headers['access-control-allow-credentials'],
        );
        check('write status', 200, renamed?.status);
        check(
          'write body',
          { id: session.projectId, name: 'From the app' },
          renamed?.body,
        );
        check('opaque origin status', 200, opaque?.status);
        check(
          'opaque origin body',
          { id: session.projectId, name: 'From a file page' },
          opaque?.body,
        );
        check(
          'the last name holds',
          'From a file page',
          await projectName(session),
        );
      },
    }),
    defineCase({
      name: 'a cookie, no credential or an unknown bearer cannot write from another origin',
      async setup(session) {
        return {
          cookie: await browserCookie(session),
          name: await projectName(session),
        };
      },
      request: (session, state) => [
        rename(session, 'Cookie', {
          headers: fromApp,
          auth: { cookie: state.cookie },
        }),
        rename(session, 'Nobody', { headers: fromApp, auth: 'none' }),
        rename(session, 'Unknown', {
          headers: fromApp,
          auth: { bearer: 'pcd_not-a-device' },
        }),
      ],
      async expect({ responses, state, session, check }) {
        const [cookie, nobody, unknown] = responses;
        check('cookie status', 403, cookie?.status);
        check('cookie body', refusedFromApp, cookie?.body);
        check('no credential status', 403, nobody?.status);
        check('no credential body', refusedFromApp, nobody?.body);
        check('unknown bearer status', 401, unknown?.status);
        check('unknown bearer body', unauthenticated, unknown?.body);
        check('the name is unchanged', state.name, await projectName(session));
      },
    }),
    defineCase({
      name: 'an empty or unknown bearer beside a valid cookie never authenticates by the cookie',
      async setup(session) {
        return {
          cookie: await browserCookie(session),
          name: await projectName(session),
        };
      },
      request: (session, state) => [
        rename(session, 'Empty bearer', {
          headers: { ...fromApp, authorization: 'Bearer ' },
          auth: { cookie: state.cookie },
        }),
        rename(session, 'Unknown bearer', {
          headers: { ...fromApp, authorization: 'Bearer pcd_not-a-device' },
          auth: { cookie: state.cookie },
        }),
        rename(session, 'Unknown bearer here', {
          headers: { authorization: 'Bearer pcd_not-a-device' },
          auth: { cookie: state.cookie },
        }),
      ],
      async expect({ responses, state, session, check }) {
        const [empty, unknown, here] = responses;
        check('empty bearer status', 403, empty?.status);
        check('empty bearer body', refusedFromApp, empty?.body);
        check('unknown bearer status', 401, unknown?.status);
        check('unknown bearer body', unauthenticated, unknown?.body);
        check('same-origin unknown bearer status', 401, here?.status);
        check('same-origin unknown bearer body', unauthenticated, here?.body);
        check('the name is unchanged', state.name, await projectName(session));
      },
    }),
    defineCase({
      name: 'a bearer client from a host the server does not answer to is refused',
      setup: projectName,
      request: (session) =>
        rename(session, 'Rebound', {
          headers: {
            host: 'rebound.example',
            origin: 'http://rebound.example',
          },
        }),
      async expect({ response, state, session, check }) {
        check('status', 403, response.status);
        check(
          'body',
          apiError(
            403,
            'Forbidden',
            'This server does not answer to the host rebound.example',
          ),
          response.body,
        );
        check('the name is unchanged', state, await projectName(session));
      },
    }),
    defineCase({
      name: 'a pairing code is redeemed from another origin without a cookie',
      async setup(session) {
        const owner = await read(session, {
          method: 'GET',
          path: '/access',
          target: 'owner',
        });
        return {
          code: await issuePairing(session, 'Desktop app'),
          route: record(list(owner.devices)[0]).route,
        };
      },
      request: (_session, state) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        headers: { ...fromApp, 'x-porcelain-browser': '1' },
        body: { code: state.code, platform: 'macOS' },
      }),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
        checkMatch,
      }) {
        check('status', 200, response.status);
        checkContract('contract', redeemPairingResponseSchema, response.body);
        const body = record(response.body);
        checkPartial(
          'device',
          { label: 'Desktop app', platform: 'macOS' },
          body.device,
        );
        checkMatch('credential in the body', credentialForm, body.credential);
        check('no cookie', undefined, response.headers['set-cookie']);
        check(
          'readable from any origin',
          '*',
          response.headers['access-control-allow-origin'],
        );
        const reading = await session.send({
          method: 'GET',
          path: '/api/inventory',
          headers: fromApp,
          auth: { bearer: text(body.credential) },
        });
        check('the credential reads from the app', 200, reading.status);
        const owner = await read(session, {
          method: 'GET',
          path: '/access',
          target: 'owner',
        });
        checkContract('owner access contract', listAccessResponseSchema, owner);
        checkPartial(
          'bound to the route the request reached',
          [{ label: 'Desktop app', route: state.route }],
          list(owner.devices).filter(
            (device) => record(device).id === record(body.device).id,
          ),
        );
      },
    }),
    defineCase({
      name: 'sharing stays with the host browser',
      setup: (session) =>
        read(session, { method: 'GET', path: '/access', target: 'owner' }),
      request: () => [
        { method: 'GET', path: '/api/access', headers: fromApp },
        {
          method: 'POST',
          path: '/api/access/revoke',
          headers: fromApp,
          body: { id: 'unknown' },
        },
      ],
      async expect({ responses, state, session, check }) {
        const [listed, revoked] = responses;
        check('read status', 403, listed?.status);
        check('read body', notOnThisComputer, listed?.body);
        check('revoke status', 403, revoked?.status);
        check('revoke body', refusedFromApp, revoked?.body);
        check(
          'nothing changed',
          state,
          await read(session, {
            method: 'GET',
            path: '/access',
            target: 'owner',
          }),
        );
      },
    }),
  ],
});

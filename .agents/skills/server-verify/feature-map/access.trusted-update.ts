import {
  readServiceUpdateResponseSchema,
  startServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  record,
  text,
  unauthenticated,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import {
  eventually,
  issuePairing,
  pairDevice,
  read,
} from '../scripts/fixture.ts';

const updatePath = '/api/service/update';
const status = { method: 'GET', path: updatePath } as const;
const app = 'http://app.example';
const tunnelHost = 'porcelain.example.com';
const throughTunnel = { host: tunnelHost, origin: `https://${tunnelHost}` };
const untrusted = apiError(
  403,
  'Forbidden',
  'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain',
);
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${app} cannot write here`,
);
const settled = (body: Record<string, unknown>) => body.running === false;

function start(
  version: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest {
  return { method: 'POST', path: updatePath, body: { version }, ...request };
}

async function setTrust(session: Session, id: string, trusted: boolean) {
  await read(session, {
    method: 'POST',
    path: '/access/trust',
    target: 'owner',
    body: { id, trusted },
  });
}

async function trustedDevice(session: Session, label: string) {
  const device = await pairDevice(session, label);
  await setTrust(session, device.deviceId, true);
  return device;
}

async function tunnelOn(session: Session) {
  await read(session, {
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true, cloudflareHostname: tunnelHost },
  });
  await eventually(
    session,
    { method: 'GET', path: '/api/remote-access' },
    (body) =>
      record(record(record(body.routes).cloudflare).status).kind === 'on',
  );
}

async function browserCookie(
  session: Session,
  headers: Record<string, string>,
) {
  const code = await issuePairing(session, 'Browser');
  const paired = await session.read({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: { ...headers, 'x-porcelain-browser': '1' },
    body: { code, platform: 'Browser' },
  });
  const cookie = /porcelain_device=[^;]+/.exec(
    paired.headers['set-cookie'] ?? '',
  )?.[0];
  if (!cookie) throw new Error('Browser pairing set no device cookie');
  return { cookie, deviceId: text(record(record(paired.body).device).id) };
}

export default defineFeature({
  feature: 'access.trusted-update',
  reaches: ['GET /api/service/update', 'POST /api/service/update'],
  paired: true,
  intent: 'intended',
  behaviour:
    "A device the owner trusts updates Porcelain from wherever it was paired: the desktop app updates a remote computer with its bearer credential from its own origin, and a browser on the web a server serves updates that server with its device cookie. It authenticates exactly as every paired request does, so a revoked device is refused as unauthenticated, and a cookie-authenticated update still has to come from the server's own origin. A paired device the owner has not trusted, or has stopped trusting, is refused with a message that an owner must trust it on that computer first, so a phone whose credential leaked can read the server but never replace its software. A browser on the computer that runs Porcelain updates it as before, trusted or not (access.service-update). The update status tells each caller whether it may start an update, so an app shows the action only where it would work.",
  cases: [
    defineCase({
      name: 'the status tells each caller whether it may start an update',
      async setup(session) {
        return {
          phone: await pairDevice(session, 'Status phone'),
          desktop: await trustedDevice(session, 'Status desktop'),
        };
      },
      request: (_session, state) => [
        status,
        { ...status, headers: { 'x-forwarded-for': '203.0.113.9' } },
        {
          ...status,
          auth: { bearer: state.phone.credential },
          headers: { origin: app },
        },
        {
          ...status,
          auth: { bearer: state.desktop.credential },
          headers: { origin: app },
        },
      ],
      expect({ responses, check, checkContract, checkPartial }) {
        const [here, relayed, phone, desktop] = responses;
        check(
          'statuses',
          [200, 200, 200, 200],
          responses.map((response) => response.status),
        );
        checkContract('contract', readServiceUpdateResponseSchema, here?.body);
        checkPartial(
          'a browser on this computer may',
          { running: false, canUpdate: true },
          here?.body,
        );
        checkPartial(
          'the same device through a relay may not',
          { running: false, canUpdate: false },
          relayed?.body,
        );
        checkPartial(
          'an untrusted device may not',
          { running: false, canUpdate: false },
          phone?.body,
        );
        checkPartial(
          'a trusted device may',
          { running: false, canUpdate: true },
          desktop?.body,
        );
        check(
          'the trusted device reads it from its own origin',
          '*',
          desktop?.headers['access-control-allow-origin'],
        );
      },
    }),
    defineCase({
      name: 'an untrusted device is refused from another origin and through a relay',
      async setup(session) {
        return {
          device: await pairDevice(session, 'Phone'),
          before: await read(session, status),
        };
      },
      request: (_session, state) => [
        start(state.before.latest, {
          auth: { bearer: state.device.credential },
          headers: { origin: app },
        }),
        start(state.before.latest, {
          headers: { 'x-forwarded-for': '203.0.113.9' },
        }),
      ],
      async expect({ responses, state, session, check }) {
        const [bearer, relayed] = responses;
        check('untrusted bearer status', 403, bearer?.status);
        check('untrusted bearer body', untrusted, bearer?.body);
        check('relayed status', 403, relayed?.status);
        check('relayed body', untrusted, relayed?.body);
        check('nothing started', state.before, await read(session, status));
      },
    }),
    defineCase({
      name: 'a device the owner stops trusting is refused at once',
      async setup(session) {
        const device = await trustedDevice(session, 'Old laptop');
        const before = await read(session, {
          ...status,
          auth: { bearer: device.credential },
          headers: { origin: app },
        });
        await setTrust(session, device.deviceId, false);
        return { device, before };
      },
      request: (_session, state) =>
        start(state.before.latest, {
          auth: { bearer: state.device.credential },
          headers: { origin: app },
        }),
      async expect({ response, state, session, check }) {
        check('status', 403, response.status);
        check('body', untrusted, response.body);
        check('nothing started', state.before, await read(session, status));
      },
    }),
    defineCase({
      name: 'a revoked trusted device is refused as unauthenticated',
      async setup(session) {
        const issued = await read(session, {
          method: 'POST',
          path: '/pairings',
          target: 'owner',
          body: {
            labels: ['Lost desktop'],
            addresses: [session.address],
            trusted: true,
          },
        });
        const paired = await read(session, {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: {
            code: text(record(list(issued.grants)[0]).code),
            platform: 'macOS',
          },
        });
        await read(session, {
          method: 'POST',
          path: '/access/revoke',
          target: 'owner',
          body: { id: text(record(paired.device).id) },
        });
        return {
          bearer: text(paired.credential),
          before: await read(session, status),
        };
      },
      request: (_session, state) =>
        start(state.before.latest, {
          auth: { bearer: state.bearer },
          headers: { origin: app },
        }),
      async expect({ response, state, session, check }) {
        check('status', 401, response.status);
        check('body', unauthenticated, response.body);
        check('nothing started', state.before, await read(session, status));
      },
    }),
    defineCase({
      name: 'a trusted device cannot update with its cookie from another origin',
      async setup(session) {
        const browser = await browserCookie(session, {});
        await setTrust(session, browser.deviceId, true);
        return { cookie: browser.cookie, before: await read(session, status) };
      },
      request: (_session, state) =>
        start(state.before.latest, {
          auth: { cookie: state.cookie },
          headers: { origin: app },
        }),
      async expect({ response, state, session, check }) {
        check('status', 403, response.status);
        check('body', refusedFromApp, response.body);
        check('nothing started', state.before, await read(session, status));
      },
    }),
    defineCase({
      name: 'a trusted bearer client on another origin starts an update',
      async setup(session) {
        return {
          device: await trustedDevice(session, 'Desktop app'),
          before: await read(session, status),
        };
      },
      request: (_session, state) =>
        start(state.before.latest, {
          auth: { bearer: state.device.credential },
          headers: { origin: app },
        }),
      async expect({
        response,
        state,
        session,
        check,
        checkContract,
        checkPartial,
      }) {
        check('status', 202, response.status);
        checkContract(
          'contract',
          startServiceUpdateResponseSchema,
          response.body,
        );
        checkPartial(
          'accepted and downloading',
          {
            running: true,
            last: {
              from: state.before.version,
              target: state.before.latest,
              stage: 'downloading',
            },
            canUpdate: true,
          },
          response.body,
        );
        check(
          'readable from the app',
          '*',
          response.headers['access-control-allow-origin'],
        );
        checkPartial(
          'the scripted first update fails',
          { last: { target: state.before.latest, stage: 'failed' } },
          await eventually(session, status, settled),
        );
      },
    }),
    defineCase({
      name: 'a trusted browser on the web the server serves updates it with its cookie',
      async setup(session) {
        await tunnelOn(session);
        const browser = await browserCookie(session, throughTunnel);
        await setTrust(session, browser.deviceId, true);
        return { cookie: browser.cookie, before: await read(session, status) };
      },
      request: (_session, state) =>
        start(state.before.latest, {
          auth: { cookie: state.cookie },
          headers: throughTunnel,
        }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 202, response.status);
        checkPartial(
          'accepted',
          { running: true, last: { stage: 'downloading' } },
          response.body,
        );
        checkPartial(
          'updated to the newer version',
          {
            version: state.before.latest,
            running: false,
            last: {
              from: state.before.version,
              target: state.before.latest,
              stage: 'updated',
            },
          },
          await eventually(session, status, settled),
        );
      },
    }),
  ],
});

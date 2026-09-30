import {
  listAccessResponseSchema,
  setDeviceTrustResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import {
  eventually,
  issuePairing,
  pairDevice,
  read,
} from '../scripts/fixture.ts';

const tunnelHost = 'porcelain.example.com';
const throughTunnel = { host: tunnelHost, origin: `https://${tunnelHost}` };
const app = 'http://app.example';
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${app} cannot write here`,
);
const notFound = apiError(404, 'Not Found', 'Device not found');
const accessRead = { method: 'GET', path: '/api/access' } as const;
const ownerAccess = {
  method: 'GET',
  path: '/access',
  target: 'owner',
} as const;
const trust = (
  id: string,
  trusted: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest => ({
  method: 'POST',
  path: '/api/access/trust',
  body: { id, trusted },
  ...request,
});

function deviceTrust(listing: Record<string, unknown>, id: string) {
  const device = record(
    list(listing.devices).find((entry) => record(entry).id === id),
  );
  return { label: device.label, trusted: device.trusted };
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

export default defineFeature({
  feature: 'access.device-trust',
  reaches: ['POST /api/access/trust', 'GET /api/access'],
  paired: true,
  intent: 'intended',
  behaviour:
    "The owner decides which paired devices are trusted to update Porcelain. A paired browser on the computer that runs Porcelain trusts a paired device by its id, or stops trusting it, and the listing says for every paired device whether it is trusted. A device is untrusted until the owner trusts it; an unknown or revoked device is not found and nothing changes. Like the rest of Sharing, only this computer's loopback listener changes trust: a request a proxy on this computer relayed, a device paired through the tunnel, even a trusted one, and a bearer client on another origin are all refused, so no device can grant itself or another device the right to replace the server's software.",
  cases: [
    defineCase({
      name: 'a paired device is untrusted until the owner trusts it, and untrusted again when the owner stops',
      setup: (session) => pairDevice(session, 'Desktop'),
      request: (_session, state) => [
        accessRead,
        trust(state.deviceId, true),
        trust(state.deviceId, false),
      ],
      async expect({ responses, state, session, check, checkContract }) {
        const [before, trusted, untrusted] = responses;
        check('listing status', 200, before?.status);
        checkContract(
          'listing contract',
          listAccessResponseSchema,
          before?.body,
        );
        check(
          'untrusted when paired',
          { label: 'Desktop', trusted: false },
          deviceTrust(record(before?.body), state.deviceId),
        );
        check('trust status', 200, trusted?.status);
        checkContract(
          'trust contract',
          setDeviceTrustResponseSchema,
          trusted?.body,
        );
        check('trusted', { id: state.deviceId, trusted: true }, trusted?.body);
        check('untrust status', 200, untrusted?.status);
        check(
          'untrusted',
          { id: state.deviceId, trusted: false },
          untrusted?.body,
        );
        check(
          'the listing says it is untrusted again',
          { label: 'Desktop', trusted: false },
          deviceTrust(await read(session, accessRead), state.deviceId),
        );
      },
    }),
    defineCase({
      name: 'the listing says which devices are trusted',
      async setup(session) {
        const device = await pairDevice(session, 'Trusted desktop');
        await read(session, trust(device.deviceId, true));
      },
      request: () => accessRead,
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'each device with its trust',
          [
            { label: session.fixture.device.label, trusted: false },
            { label: 'Desktop', trusted: false },
            { label: 'Trusted desktop', trusted: true },
          ],
          list(record(response.body).devices).map((device) => ({
            label: record(device).label,
            trusted: record(device).trusted,
          })),
        );
      },
    }),
    defineCase({
      name: 'an unknown or revoked device is not found and a malformed request is refused',
      async setup(session) {
        const revoked = await pairDevice(session, 'Lost phone');
        await read(session, {
          method: 'POST',
          path: '/access/revoke',
          target: 'owner',
          body: { id: revoked.deviceId },
        });
        return {
          revoked: revoked.deviceId,
          before: await read(session, ownerAccess),
        };
      },
      request: (_session, state) => [
        trust('00000000-0000-4000-8000-000000000000', true),
        trust(state.revoked, true),
        trust(state.revoked, 'yes'),
        { method: 'POST', path: '/api/access/trust', body: { id: '' } },
      ],
      async expect({ responses, state, session, check }) {
        check(
          'statuses',
          [404, 404, 400, 400],
          responses.map((response) => response.status),
        );
        check('unknown', notFound, responses[0]?.body);
        check('revoked', notFound, responses[1]?.body);
        check('not a boolean', invalidRequest, responses[2]?.body);
        check('no id', invalidRequest, responses[3]?.body);
        check(
          'nothing changed',
          state.before,
          await read(session, ownerAccess),
        );
      },
    }),
    defineCase({
      name: 'a relayed request, a trusted device through the tunnel and a bearer client on another origin cannot change trust',
      async setup(session) {
        await tunnelOn(session);
        const code = await issuePairing(session, 'Travel laptop');
        const paired = await read(session, {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          headers: throughTunnel,
          body: { code, platform: 'macOS' },
        });
        const deviceId = text(record(paired.device).id);
        await read(session, {
          method: 'POST',
          path: '/access/trust',
          target: 'owner',
          body: { id: deviceId, trusted: true },
        });
        const other = await pairDevice(session, 'Phone');
        return {
          bearer: text(paired.credential),
          other: other.deviceId,
          before: await read(session, ownerAccess),
        };
      },
      request: (_session, state) => [
        trust(state.other, true, {
          headers: { 'x-forwarded-for': '203.0.113.9' },
        }),
        trust(state.other, true, {
          auth: { bearer: state.bearer },
          headers: throughTunnel,
        }),
        {
          ...accessRead,
          auth: { bearer: state.bearer },
          headers: throughTunnel,
        },
        trust(state.other, true, { headers: { origin: app } }),
      ],
      async expect({ responses, state, session, check }) {
        const [relayed, tunnel, tunnelListing, crossOrigin] = responses;
        check('relayed status', 403, relayed?.status);
        check('relayed body', notOnThisComputer, relayed?.body);
        check('trusted device through the tunnel status', 403, tunnel?.status);
        check(
          'trusted device through the tunnel body',
          notOnThisComputer,
          tunnel?.body,
        );
        check('its listing status', 403, tunnelListing?.status);
        check('its listing body', notOnThisComputer, tunnelListing?.body);
        check('another origin status', 403, crossOrigin?.status);
        check('another origin body', refusedFromApp, crossOrigin?.body);
        check(
          'nothing changed',
          state.before,
          await read(session, ownerAccess),
        );
      },
    }),
  ],
});

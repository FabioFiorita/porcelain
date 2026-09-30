import {
  issuePairingResponseSchema,
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
} from '../scripts/feature.ts';
import { pairDevice, read } from '../scripts/fixture.ts';

const owner = (request: Omit<HttpRequest, 'target'>): HttpRequest => ({
  ...request,
  target: 'owner',
});
const ownerAccess = owner({ method: 'GET', path: '/access' });
const notFound = apiError(404, 'Not Found', 'Device not found');

function listed(entries: unknown, id: unknown) {
  const entry = record(list(entries).find((item) => record(item).id === id));
  return { label: entry.label, trusted: entry.trusted };
}

export default defineFeature({
  feature: 'access.owner-trust',
  reaches: [
    'owner POST /pairings',
    'owner GET /access',
    'owner POST /access/trust',
    'POST /api/pair',
  ],
  paired: false,
  intent: 'intended',
  behaviour:
    'The owner trusts devices from the owner socket, the way `porcelain pair --trusted`, `porcelain trust` and `porcelain untrust` do. A pairing link issued as trusted says so, is listed as trusted while it is pending, and pairs a device that is trusted from its first request; an ordinary link pairs an untrusted device. The owner trusts or stops trusting a paired device by its id, and the listing says so; an unknown device is not found and a malformed request changes nothing.',
  cases: [
    defineCase({
      name: 'a trusted link is listed as trusted and pairs a trusted device',
      request: (session) =>
        owner({
          method: 'POST',
          path: '/pairings',
          body: {
            labels: ['Desktop'],
            addresses: [session.address],
            trusted: true,
          },
        }),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', issuePairingResponseSchema, response.body);
        const issued = record(list(record(response.body).grants)[0]);
        const grant = record(issued.grant);
        checkPartial(
          'the link is trusted',
          { label: 'Desktop', trusted: true },
          grant,
        );
        const pending = await read(session, ownerAccess);
        checkContract('listing contract', listAccessResponseSchema, pending);
        check(
          'listed as trusted while pending',
          { label: 'Desktop', trusted: true },
          listed(pending.grants, grant.id),
        );
        const paired = await read(session, {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code: text(issued.code), platform: 'macOS' },
        });
        const deviceId = record(paired.device).id;
        const listing = await read(session, ownerAccess);
        check(
          'the paired device is trusted',
          { label: 'Desktop', trusted: true },
          listed(listing.devices, deviceId),
        );
      },
    }),
    defineCase({
      name: 'an ordinary link pairs an untrusted device',
      async setup(session) {
        const issued = await read(
          session,
          owner({
            method: 'POST',
            path: '/pairings',
            body: { labels: ['Phone'], addresses: [session.address] },
          }),
        );
        const link = record(list(issued.grants)[0]);
        return { code: text(link.code), grant: record(link.grant) };
      },
      request: (_session, state) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        body: { code: state.code, platform: 'iOS' },
      }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'paired',
          { label: 'Phone', platform: 'iOS' },
          record(response.body).device,
        );
        checkPartial(
          'the link was not trusted',
          { label: 'Phone', trusted: false },
          state.grant,
        );
        const deviceId = record(record(response.body).device).id;
        const listing = await read(session, ownerAccess);
        check(
          'the paired device is untrusted',
          { label: 'Phone', trusted: false },
          listed(listing.devices, deviceId),
        );
      },
    }),
    defineCase({
      name: 'the owner trusts a device by id and stops trusting it',
      setup: (session) => pairDevice(session, 'Laptop'),
      request: (_session, state) => [
        owner({
          method: 'POST',
          path: '/access/trust',
          body: { id: state.deviceId, trusted: true },
        }),
        ownerAccess,
        owner({
          method: 'POST',
          path: '/access/trust',
          body: { id: state.deviceId, trusted: false },
        }),
      ],
      async expect({ responses, state, session, check, checkContract }) {
        const [trusted, listing, untrusted] = responses;
        check('trust status', 200, trusted?.status);
        checkContract(
          'trust contract',
          setDeviceTrustResponseSchema,
          trusted?.body,
        );
        check('trusted', { id: state.deviceId, trusted: true }, trusted?.body);
        check('listing status', 200, listing?.status);
        check(
          'listed as trusted',
          { label: 'Laptop', trusted: true },
          listed(record(listing?.body).devices, state.deviceId),
        );
        check('untrust status', 200, untrusted?.status);
        check(
          'untrusted',
          { id: state.deviceId, trusted: false },
          untrusted?.body,
        );
        check(
          'listed as untrusted',
          { label: 'Laptop', trusted: false },
          listed((await read(session, ownerAccess)).devices, state.deviceId),
        );
      },
    }),
    defineCase({
      name: 'an unknown device is not found and a malformed request changes nothing',
      setup: (session) => read(session, ownerAccess),
      request: () => [
        owner({
          method: 'POST',
          path: '/access/trust',
          body: { id: 'pcd_unknown', trusted: true },
        }),
        owner({
          method: 'POST',
          path: '/access/trust',
          body: { id: 'pcd_unknown', trusted: true, label: 'extra' },
        }),
      ],
      async expect({ responses, state, session, check }) {
        check(
          'statuses',
          [404, 400],
          responses.map((response) => response.status),
        );
        check('unknown', notFound, responses[0]?.body);
        check('malformed', invalidRequest, responses[1]?.body);
        check('nothing changed', state, await read(session, ownerAccess));
      },
    }),
  ],
});

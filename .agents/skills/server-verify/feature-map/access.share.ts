import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  unauthenticated,
  type Session,
} from '../scripts/feature.ts';
import {
  inventory,
  pairDevice,
  pairingLinkForm,
  read,
} from '../scripts/fixture.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);

async function access(session: Session) {
  return read(session, { method: 'GET', path: '/api/access' });
}

async function fixtureDeviceId(session: Session) {
  const current = list((await access(session)).devices).find(
    (device) => record(device).current === true,
  );
  return text(record(current).id);
}

export default defineFeature({
  feature: 'access.share',
  reaches: ['GET /api/access', 'POST /api/pairings', 'POST /api/access/revoke'],
  paired: true,
  intent: 'intended',
  behaviour:
    "A paired browser on the computer that runs Porcelain shares it from Settings: it lists the pending pairing links and the paired devices with when each was last seen, marking the device that asks as the current one; it issues a one-time pairing link for an address the server answers at; and it revokes a link or a device, which closes that device's live connection and refuses its next request. The same actions as the owner socket, with the same authority: a request that did not come from this computer's loopback listener, or that a proxy on this computer relayed, is refused, so a phone paired over the network or through a tunnel cannot pair or revoke devices.",
  cases: [
    defineCase({
      name: 'list the paired devices',
      request: () => ({ method: 'GET', path: '/api/access' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listAccessResponseSchema, response.body);
        check('no pending links', [], record(response.body).grants);
        check(
          'the fixture device is the current one',
          [{ ...session.fixture.device, current: true }],
          list(record(response.body).devices).map((device) => ({
            label: record(device).label,
            platform: record(device).platform,
            current: record(device).current,
          })),
        );
      },
    }),
    defineCase({
      name: 'issue a pairing link',
      request: (session) => ({
        method: 'POST',
        path: '/api/pairings',
        body: { labels: ['Phone'], addresses: [session.address] },
      }),
      async expect({
        response,
        session,
        check,
        checkPartial,
        checkContract,
        checkMatch,
      }) {
        check('status', 200, response.status);
        checkContract('contract', issuePairingResponseSchema, response.body);
        const grant = record(list(record(response.body).grants)[0]);
        checkPartial(
          'grant',
          { label: 'Phone', addresses: [session.address] },
          grant.grant,
        );
        checkMatch(
          'link opens the pairing page',
          pairingLinkForm(
            session.address,
            text((await inventory(session)).environmentId),
          ),
          grant.link,
        );
        check(
          'the link is pending',
          [record(grant.grant).id],
          list((await access(session)).grants).map((entry) => record(entry).id),
        );
      },
    }),
    defineCase({
      name: 'issue a pairing link with invalid input or for an address the server does not answer at',
      setup: access,
      request: () => [
        {
          method: 'POST',
          path: '/api/pairings',
          body: { labels: [], addresses: [] },
        },
        {
          method: 'POST',
          path: '/api/pairings',
          body: { labels: ['Phone'], addresses: ['http://203.0.113.5:4173'] },
        },
      ],
      async expect({ responses, state, session, check }) {
        check('invalid status', 400, responses[0]?.status);
        check('invalid body', invalidRequest, responses[0]?.body);
        check('unreachable status', 400, responses[1]?.status);
        check(
          'unreachable body',
          apiError(
            400,
            'Bad Request',
            'This server does not answer at that address, so a link aimed there would not reach it.',
          ),
          responses[1]?.body,
        );
        check('nothing was issued', state, await access(session));
      },
    }),
    defineCase({
      name: 'revoke a pending link and an unknown id',
      async setup(session) {
        const before = await access(session);
        const issued = await read(session, {
          method: 'POST',
          path: '/api/pairings',
          body: { labels: ['Tablet'], addresses: [session.address] },
        });
        return {
          before: before.grants,
          grantId: text(record(record(list(issued.grants)[0]).grant).id),
        };
      },
      request: (_session, state) => [
        {
          method: 'POST',
          path: '/api/access/revoke',
          body: { id: state.grantId },
        },
        { method: 'POST', path: '/api/access/revoke', body: { id: 'unknown' } },
      ],
      async expect({ responses, state, session, check, checkContract }) {
        check('status', 200, responses[0]?.status);
        checkContract(
          'contract',
          revokeAccessResponseSchema,
          responses[0]?.body,
        );
        check(
          'link revoked',
          { revoked: true, kind: 'grant' },
          responses[0]?.body,
        );
        check('unknown status', 200, responses[1]?.status);
        check('nothing to revoke', { revoked: false }, responses[1]?.body);
        check(
          'only the links pending before remain',
          state.before,
          (await access(session)).grants,
        );
      },
    }),
    defineCase({
      name: 'a relayed or remote request is refused',
      setup: access,
      request: (session) => [
        {
          method: 'GET',
          path: '/api/access',
          headers: { 'x-forwarded-for': '203.0.113.9' },
        },
        {
          method: 'POST',
          path: '/api/pairings',
          headers: { 'cf-connecting-ip': '203.0.113.9' },
          body: { labels: ['Intruder'], addresses: [session.address] },
        },
        {
          method: 'POST',
          path: '/api/access/revoke',
          headers: { forwarded: 'for=203.0.113.9' },
          body: { id: 'unknown' },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 403, response.status);
          check(`request ${index + 1} body`, notOnThisComputer, response.body);
        }
        check('nothing changed', state, await access(session));
      },
    }),
    defineCase({
      name: 'revoke a device closes its live connection and refuses its next request',
      async setup(session) {
        const connection = await session.live();
        await connection.next((notice) => notice.type === 'ready');
        const other = await pairDevice(session, 'Laptop');
        return {
          connection,
          other,
          revoked: await fixtureDeviceId(session),
        };
      },
      request: (_session, state) => [
        {
          method: 'POST',
          path: '/api/access/revoke',
          auth: { bearer: state.other.credential },
          body: { id: state.revoked },
        },
        { method: 'GET', path: '/api/inventory' },
      ],
      async expect({ responses, state, session, check }) {
        check('status', 200, responses[0]?.status);
        check(
          'device revoked',
          { revoked: true, kind: 'device' },
          responses[0]?.body,
        );
        check(
          'its live connection closed',
          { code: 4001, reason: 'Device access revoked' },
          await state.connection.closed(),
        );
        check('its next request status', 401, responses[1]?.status);
        check('its next request body', unauthenticated, responses[1]?.body);
        const remaining = await read(session, {
          method: 'GET',
          path: '/api/access',
          auth: { bearer: state.other.credential },
        });
        check(
          'the device is no longer listed',
          ['Laptop'],
          list(remaining.devices).map((device) => record(device).label),
        );
      },
    }),
  ],
});

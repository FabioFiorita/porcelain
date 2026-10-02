import {
  listAccessResponseSchema,
  readRemoteAccessResponseSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import { apiError, defineCase, defineFeature } from '../scripts/feature.ts';
import { type Session } from '../../../../apps/server/spec/kit/session.ts';
import { read } from '../../../../apps/server/spec/kit/requests.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const tunnelPage = 'https://porcelain.example.com';

function hostPage(session: Session) {
  return new URL(session.address).origin;
}

async function sharing(session: Session) {
  return {
    access: await read(session, { method: 'GET', path: '/api/access' }),
    remoteAccess: await read(session, {
      method: 'GET',
      path: '/api/remote-access',
    }),
  };
}

export default defineFeature({
  feature: 'access.host-authority',
  reaches: [
    'GET /api/access',
    'GET /api/remote-access',
    'POST /api/access/revoke',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    "Only the computer that runs Porcelain manages sharing, and a request that reaches its loopback listener is taken for that computer's only when the browser that sent it says so too: a browser page on this listener that names itself as the origin or the referrer, and says the request is same-origin, is answered, while one whose origin, referrer or fetch site shows it came from another page (a tunnel page, a page on the local network, another loopback server, or another site) is refused, as a request a proxy on this computer relayed without saying so would be. A client that sends none of these browser headers is judged by its address and Host alone.",
  cases: [
    defineCase({
      name: 'the host browser reads and changes sharing',
      request: (session) => [
        {
          method: 'GET',
          path: '/api/access',
          headers: {
            origin: hostPage(session),
            referer: `${hostPage(session)}/settings`,
            'sec-fetch-site': 'same-origin',
          },
        },
        {
          method: 'GET',
          path: '/api/remote-access',
          headers: {
            referer: `${hostPage(session)}/settings`,
            'sec-fetch-site': 'same-origin',
          },
        },
        {
          method: 'POST',
          path: '/api/access/revoke',
          headers: {
            origin: hostPage(session),
            referer: `${hostPage(session)}/settings`,
            'sec-fetch-site': 'same-origin',
          },
          body: { id: 'unknown' },
        },
      ],
      expect({ responses, check, checkContract }) {
        check('devices status', 200, responses[0]?.status);
        checkContract(
          'devices body',
          listAccessResponseSchema,
          responses[0]?.body,
        );
        check('routes status', 200, responses[1]?.status);
        checkContract(
          'routes body',
          readRemoteAccessResponseSchema,
          responses[1]?.body,
        );
        check('revoke status', 200, responses[2]?.status);
        checkContract(
          'revoke body',
          revokeAccessResponseSchema,
          responses[2]?.body,
        );
      },
    }),
    defineCase({
      name: 'a browser that asked from another page is refused',
      setup: sharing,
      request: (session) => [
        {
          method: 'GET',
          path: '/api/access',
          headers: { origin: tunnelPage },
        },
        {
          method: 'GET',
          path: '/api/remote-access',
          headers: { referer: `${tunnelPage}/settings` },
        },
        {
          method: 'GET',
          path: '/api/access',
          headers: { origin: 'http://127.0.0.1:1' },
        },
        {
          method: 'GET',
          path: '/api/remote-access',
          headers: { 'sec-fetch-site': 'cross-site' },
        },
        {
          method: 'POST',
          path: '/api/access/revoke',
          headers: {
            referer: `${hostPage(session)}/settings`,
            'sec-fetch-site': 'same-site',
          },
          body: { id: 'unknown' },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 403, response.status);
          check(`request ${index + 1} body`, notOnThisComputer, response.body);
        }
        check('nothing changed', state, await sharing(session));
      },
    }),
  ],
});

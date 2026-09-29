import { listAccessResponseSchema } from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  defineCase,
  defineFeature,
  list,
  record,
  text,
  unauthenticated,
  type Session,
} from '../scripts/feature.ts';
import { eventually, issuePairing, read } from '../scripts/fixture.ts';

const tunnelHost = 'porcelain.example.com';
const throughTunnel = { host: tunnelHost, origin: `https://${tunnelHost}` };
const inventoryRead = { method: 'GET', path: '/api/inventory' } as const;

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
  feature: 'access.device-routes',
  reaches: ['GET /api/inventory', 'GET /api/access', 'POST /api/pair'],
  paired: false,
  intent: 'intended',
  behaviour:
    "A device credential is bound to the way in it was paired over: this computer's loopback listener, the local network, the tailnet or the Cloudflare tunnel. The server accepts the credential only over that route and answers any other with the same refusal as an unknown credential, so a credential read off one route cannot be replayed through another. A phone that uses two ways in is paired once over each. The listing names the route of every paired device.",
  cases: [
    defineCase({
      name: 'the device paired on this computer is refused through the tunnel',
      setup: tunnelOn,
      request: () => [
        inventoryRead,
        { ...inventoryRead, headers: throughTunnel },
      ],
      expect({ responses, check, checkContract }) {
        check('on this computer status', 200, responses[0]?.status);
        checkContract(
          'on this computer body',
          readInventoryResponseSchema,
          responses[0]?.body,
        );
        check('through the tunnel status', 401, responses[1]?.status);
        check('through the tunnel body', unauthenticated, responses[1]?.body);
      },
    }),
    defineCase({
      name: 'a device paired through the tunnel works only through the tunnel',
      setup: (session) => issuePairing(session, 'Travel phone'),
      request: (_session, code) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        headers: throughTunnel,
        body: { code, platform: 'iOS' },
      }),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('paired status', 200, response.status);
        checkPartial(
          'the paired device',
          { label: 'Travel phone', platform: 'iOS' },
          record(response.body).device,
        );
        const bearer = text(record(response.body).credential);
        const tunnelRead = await session.send({
          ...inventoryRead,
          auth: { bearer },
          headers: throughTunnel,
        });
        check('through the tunnel status', 200, tunnelRead.status);
        checkContract(
          'through the tunnel body',
          readInventoryResponseSchema,
          tunnelRead.body,
        );
        const directRead = await session.send({
          ...inventoryRead,
          auth: { bearer },
        });
        check('on this computer status', 401, directRead.status);
        check('on this computer body', unauthenticated, directRead.body);
      },
    }),
    defineCase({
      name: 'the listing names the route each device was paired over',
      request: () => ({ method: 'GET', path: '/api/access' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listAccessResponseSchema, response.body);
        check(
          'each device with its route',
          [
            { label: session.fixture.device.label, route: 'loopback' },
            { label: 'Travel phone', route: 'tunnel' },
          ],
          list(record(response.body).devices).map((device) => ({
            label: record(device).label,
            route: record(device).route,
          })),
        );
      },
    }),
  ],
});

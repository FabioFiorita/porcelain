import {
  issuePairingResponseSchema,
  readRemoteAccessResponseSchema,
  setRemoteAccessResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import { eventually, issuePairing, read } from '../scripts/fixture.ts';

const tunnelHost = 'porcelain.example.com';
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const notAnswered = apiError(
  403,
  'Forbidden',
  `This server does not answer to the host ${tunnelHost}`,
);
const remoteAccess = { method: 'GET', path: '/api/remote-access' } as const;
const fixtureNetwork = { interfaceName: 'eth0', subnet: '192.168.1.0/24' };
const throughTunnel = {
  method: 'GET',
  path: '/api/health',
  auth: 'none',
  headers: { host: tunnelHost },
} as const;

function routes(body: Record<string, unknown>) {
  return record(body.routes);
}

function status(body: Record<string, unknown>, route: string) {
  return record(record(routes(body)[route]).status);
}

async function settled(session: Session, route: string, kind: string) {
  return eventually(session, remoteAccess, (body) => {
    const current = status(body, route).kind;
    return current !== 'starting' && (kind === '' || current === kind);
  });
}

export default defineFeature({
  feature: 'access.remote-access',
  reaches: ['GET /api/remote-access', 'PATCH /api/remote-access'],
  paired: true,
  intent: 'intended',
  behaviour:
    "A paired browser on the computer that runs Porcelain turns the ways in on and off: the local network, the Tailscale tailnet and the user's own Cloudflare tunnel with its public hostname. The choice is saved; each route reports whether it is off, starting, on with the addresses it serves, or failed with a reason. Turning the local network on records the network the computer is on, the private IPv4 network of the physical interface that carries the default route, and the server listens there only, never on Docker, libvirt or VPN interfaces, and pauses on any other network (the fixture's computer is on 192.168.1.0/24 through eth0 at 192.168.1.20, with a Docker bridge and a VPN beside it, and has no tailnet); it listens at the tailnet addresses, and it answers to the tunnel hostname only while Cloudflare is on; it checks the tunnel by asking its own health through the hostname (the fixture's tunnel reaches this server for any hostname except one under .invalid, which nothing answers). An address that a route serves can be named in a pairing link. Turning Cloudflare on needs a readable public HTTPS hostname. As with pairing, only a request from this computer's loopback listener may change them, so a device that came in through a route cannot.",
  cases: [
    defineCase({
      name: 'every route is off at first',
      request: () => remoteAccess,
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readRemoteAccessResponseSchema,
          response.body,
        );
        const off = { enabled: false, status: { kind: 'off' } };
        check(
          'body',
          {
            routes: { lan: off, tailnet: off, cloudflare: off },
            localNetwork: fixtureNetwork,
            serviceUrl: session.address,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'change the routes with invalid input',
      setup: (session) => read(session, remoteAccess),
      request: () => [
        { method: 'PATCH', path: '/api/remote-access', body: {} },
        { method: 'PATCH', path: '/api/remote-access', body: { lan: 'yes' } },
        {
          method: 'PATCH',
          path: '/api/remote-access',
          body: { cloudflare: true },
        },
        {
          method: 'PATCH',
          path: '/api/remote-access',
          body: {
            cloudflare: true,
            cloudflareHostname: 'http://x.example.com',
          },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(`request ${index + 1} body`, invalidRequest, response.body);
        }
        check('missing hostname status', 400, responses[2]?.status);
        check(
          'missing hostname body',
          apiError(
            400,
            'Bad Request',
            'Cloudflare needs the public hostname your tunnel serves.',
          ),
          responses[2]?.body,
        );
        check('unreadable hostname status', 400, responses[3]?.status);
        check(
          'unreadable hostname body',
          apiError(
            400,
            'Bad Request',
            'Enter the public hostname your Cloudflare tunnel serves, such as porcelain.example.com.',
          ),
          responses[3]?.body,
        );
        check('nothing changed', state, await read(session, remoteAccess));
      },
    }),
    defineCase({
      name: 'turn on the local network and the tailnet',
      request: () => ({
        method: 'PATCH',
        path: '/api/remote-access',
        body: { lan: true, tailnet: true },
      }),
      async expect({ response, session, check, checkContract, checkMatch }) {
        check('status', 200, response.status);
        checkContract('contract', setRemoteAccessResponseSchema, response.body);
        const starting = { enabled: true, status: { kind: 'starting' } };
        check(
          'local network starting',
          starting,
          routes(record(response.body)).lan,
        );
        check(
          'tailnet starting',
          starting,
          routes(record(response.body)).tailnet,
        );
        check(
          'turned on for the network the computer is on',
          fixtureNetwork,
          record(response.body).lanNetwork,
        );
        const opened = await settled(session, 'lan', 'on');
        const settledTailnet = await settled(session, 'tailnet', '');
        check(
          'one address on the local network, none on Docker or the VPN',
          1,
          [status(opened, 'lan').urls].flat().length,
        );
        checkMatch(
          'local network serves the private address on the server port',
          /^http:\/\/192\.168\.1\.20:\d+$/,
          [status(opened, 'lan').urls].flat()[0],
        );
        check(
          'the tailnet fails for want of an address',
          { kind: 'failed', reason: 'no-address' },
          status(settledTailnet, 'tailnet'),
        );
        const link = await read(session, {
          method: 'POST',
          path: '/api/pairings',
          body: {
            labels: ['Phone'],
            addresses: [status(opened, 'lan').urls].flat(),
          },
        });
        checkContract(
          'a link can name the address',
          issuePairingResponseSchema,
          link,
        );
      },
    }),
    defineCase({
      name: 'turn the local network off',
      setup: (session) => settled(session, 'lan', 'on'),
      request: () => ({
        method: 'PATCH',
        path: '/api/remote-access',
        body: { lan: false },
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'saved off, still serving until it closes',
          { enabled: false, status: status(state, 'lan') },
          routes(record(response.body)).lan,
        );
        check(
          'the route closes',
          { enabled: false, status: { kind: 'off' } },
          routes(await settled(session, 'lan', 'off')).lan,
        );
        const refused = await session.send({
          method: 'POST',
          path: '/api/pairings',
          body: {
            labels: ['Phone'],
            addresses: [status(state, 'lan').urls].flat(),
          },
        });
        check('a link can no longer name its address', 400, refused.status);
        check(
          'refusal body',
          apiError(
            400,
            'Bad Request',
            'This server does not answer at that address, so a link aimed there would not reach it.',
          ),
          refused.body,
        );
      },
    }),
    defineCase({
      name: 'the tunnel hostname is answered only while Cloudflare is on',
      request: () => [
        throughTunnel,
        {
          method: 'PATCH',
          path: '/api/remote-access',
          body: {
            cloudflare: true,
            cloudflareHostname: `https://${tunnelHost}/`,
          },
        },
        throughTunnel,
      ],
      async expect({ responses, session, check }) {
        check('refused before status', 403, responses[0]?.status);
        check('refused before body', notAnswered, responses[0]?.body);
        check('turned on status', 200, responses[1]?.status);
        check(
          'hostname saved the canonical way',
          tunnelHost,
          record(responses[1]?.body).cloudflareHostname,
        );
        check(
          'checking the tunnel',
          { enabled: true, status: { kind: 'starting' } },
          routes(record(responses[1]?.body)).cloudflare,
        );
        check('answered while on status', 200, responses[2]?.status);
        check(
          'answered while on body',
          'ok',
          record(responses[2]?.body).status,
        );
        check(
          'the tunnel reaches this server',
          { kind: 'on', urls: [`https://${tunnelHost}`] },
          status(await settled(session, 'cloudflare', 'on'), 'cloudflare'),
        );
        const link = await read(session, {
          method: 'POST',
          path: '/api/pairings',
          body: { labels: ['Phone'], addresses: [`https://${tunnelHost}`] },
        });
        check(
          'a link can name the tunnel',
          [`https://${tunnelHost}`],
          record(record([link.grants].flat()[0]).grant).addresses,
        );
      },
    }),
    defineCase({
      name: 'a device paired through a route cannot change them',
      async setup(session) {
        const paired = await read(session, {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          headers: { host: tunnelHost, origin: `https://${tunnelHost}` },
          body: { code: await issuePairing(session, 'Phone'), platform: 'iOS' },
        });
        return {
          before: await read(session, remoteAccess),
          bearer: text(paired.credential),
        };
      },
      request: (_session, { bearer }) => [
        {
          method: 'PATCH',
          path: '/api/remote-access',
          auth: { bearer },
          headers: { host: tunnelHost, origin: `https://${tunnelHost}` },
          body: { lan: true },
        },
        {
          method: 'GET',
          path: '/api/remote-access',
          headers: { 'x-forwarded-for': '203.0.113.9' },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 403, response.status);
          check(`request ${index + 1} body`, notOnThisComputer, response.body);
        }
        check(
          'nothing changed',
          state.before,
          await read(session, remoteAccess),
        );
      },
    }),
    defineCase({
      name: 'turn Cloudflare off',
      request: () => [
        {
          method: 'PATCH',
          path: '/api/remote-access',
          body: { cloudflare: false },
        },
        throughTunnel,
      ],
      async expect({ responses, session, check }) {
        check('status', 200, responses[0]?.status);
        check(
          'the hostname is kept',
          tunnelHost,
          record(responses[0]?.body).cloudflareHostname,
        );
        check('refused again status', 403, responses[1]?.status);
        check('refused again body', notAnswered, responses[1]?.body);
        check(
          'the route closes',
          { enabled: false, status: { kind: 'off' } },
          routes(await settled(session, 'cloudflare', 'off')).cloudflare,
        );
      },
    }),
    defineCase({
      name: 'a hostname nothing answers at fails the tunnel',
      request: () => ({
        method: 'PATCH',
        path: '/api/remote-access',
        body: { cloudflare: true, cloudflareHostname: 'porcelain.invalid' },
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'checking the tunnel',
          { kind: 'starting' },
          status(record(response.body), 'cloudflare'),
        );
        check(
          'nothing answers',
          { kind: 'failed', reason: 'unreachable' },
          status(await settled(session, 'cloudflare', 'failed'), 'cloudflare'),
        );
      },
    }),
  ],
});

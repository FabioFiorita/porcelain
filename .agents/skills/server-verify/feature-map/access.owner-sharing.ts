import {
  readRemoteAccessResponseSchema,
  setRemoteAccessResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
} from '../scripts/feature.ts';
import {
  record,
  type HttpRequest,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import { eventually } from '../scripts/fixture.ts';
import { read } from '../../../../apps/server/spec/kit/requests.ts';

const tailnetHost = 'porcelain.tail0000.ts.net';
const owner = (request: Omit<HttpRequest, 'target'>): HttpRequest => ({
  ...request,
  target: 'owner',
});
const remoteAccess = owner({ method: 'GET', path: '/remote-access' });
const change = (body: unknown) =>
  owner({ method: 'PATCH', path: '/remote-access', body });

function status(body: Record<string, unknown>, route: string) {
  return record(record(record(body.routes)[route]).status);
}

async function settled(session: Session, route: string, kind: string) {
  return eventually(session, remoteAccess, (body) => {
    const current = status(body, route).kind;
    return current !== 'starting' && current === kind;
  });
}

export default defineFeature({
  feature: 'access.owner-sharing',
  reaches: ['owner GET /remote-access', 'owner PATCH /remote-access'],
  paired: false,
  intent: 'intended',
  behaviour:
    "The machine owner shares a headless server from its shell, over the owner socket, with the same choices a browser on that computer makes in Settings: turn the local network, the Tailscale tailnet (with the machine's Tailscale name) and the owner's Cloudflare tunnel (with its public hostname) on or off, and read each route's state, its addresses and the loopback listener to forward Tailscale Serve to. Asking to turn a route on that is already on checks it again. Invalid choices are refused as in Settings, and the network listener never answers these owner routes.",
  cases: [
    defineCase({
      name: 'the owner reads every route off at first',
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
          'every route off',
          { lan: off, tailnet: off, cloudflare: off },
          record(response.body).routes,
        );
        check(
          'the address the service answers at',
          session.address,
          record(response.body).serviceUrl,
        );
      },
    }),
    defineCase({
      name: 'the owner turns the local network and the tailnet on',
      request: () =>
        change({ lan: true, tailnet: true, tailnetHostname: tailnetHost }),
      async expect({ response, session, check, checkContract, checkMatch }) {
        check('status', 200, response.status);
        checkContract('contract', setRemoteAccessResponseSchema, response.body);
        check(
          'local network starting',
          { kind: 'starting' },
          status(record(response.body), 'lan'),
        );
        const lan = await settled(session, 'lan', 'on');
        checkMatch(
          'serves the private address',
          /^http:\/\/192\.168\.1\.20:\d+$/,
          [status(lan, 'lan').urls].flat()[0],
        );
        const tailnet = await settled(session, 'tailnet', 'on');
        check(
          'names the listener for tailscale serve',
          'http://127.0.0.1:41000',
          tailnet.tailnetTarget,
        );
      },
    }),
    defineCase({
      name: 'turning an active route on again checks it again',
      setup: (session) => settled(session, 'lan', 'on'),
      request: () => change({ lan: true }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'checking again',
          { enabled: true, status: { kind: 'starting' } },
          record(record(response.body).routes).lan,
        );
        check(
          'on again at the same address',
          status(state, 'lan'),
          status(await settled(session, 'lan', 'on'), 'lan'),
        );
      },
    }),
    defineCase({
      name: 'the owner turns the local network off',
      request: () => change({ lan: false }),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'saved off',
          { routes: { lan: { enabled: false } } },
          response.body,
        );
        check(
          'the route closes',
          { kind: 'off' },
          status(await settled(session, 'lan', 'off'), 'lan'),
        );
      },
    }),
    defineCase({
      name: 'invalid choices are refused',
      setup: (session) => read(session, remoteAccess),
      request: () => [
        change({}),
        change({ tailnet: true, tailnetHostname: 'porcelain.example.com' }),
        change({ cloudflare: true }),
      ],
      async expect({ responses, state, session, check }) {
        check('empty change status', 400, responses[0]?.status);
        check('empty change body', invalidRequest, responses[0]?.body);
        check('Tailscale name status', 400, responses[1]?.status);
        check(
          'Tailscale name body',
          apiError(
            400,
            'Bad Request',
            "Enter this computer's Tailscale name, such as laptop.tail1234.ts.net.",
          ),
          responses[1]?.body,
        );
        check('Cloudflare hostname status', 400, responses[2]?.status);
        check(
          'Cloudflare hostname body',
          apiError(
            400,
            'Bad Request',
            'Cloudflare needs the public hostname your tunnel serves.',
          ),
          responses[2]?.body,
        );
        check('nothing changed', state, await read(session, remoteAccess));
      },
    }),
    defineCase({
      name: 'the network listener does not answer the owner routes',
      setup: (session) => read(session, remoteAccess),
      request: () => [
        { method: 'GET', path: '/remote-access' },
        { method: 'PATCH', path: '/remote-access', body: { lan: true } },
      ],
      async expect({ responses, state, session, check }) {
        check('read status', 200, responses[0]?.status);
        check(
          'read answers the web shell',
          session.fixture.web.shell,
          responses[0]?.body,
        );
        check('write status', 404, responses[1]?.status);
        check(
          'write body',
          apiError(404, 'Not Found', 'Route PATCH:/remote-access not found'),
          responses[1]?.body,
        );
        check('nothing changed', state, await read(session, remoteAccess));
      },
    }),
  ],
});

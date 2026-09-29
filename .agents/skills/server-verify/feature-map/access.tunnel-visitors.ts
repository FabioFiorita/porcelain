import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  apiError,
  defineCase,
  defineFeature,
  record,
  unauthenticated,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import {
  deviceCookieForm,
  eventually,
  issuePairing,
  literally,
  read,
} from '../scripts/fixture.ts';

const tunnelHost = 'porcelain.example.com';
const tunnelPage = `https://${tunnelHost}`;
const secureCookieForm = new RegExp(
  `${deviceCookieForm.source.replace(/\$$/, '')}${literally('; Secure')}$`,
);
const strictTransport = 'max-age=31536000';
const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);
const limited = apiError(
  429,
  'Too Many Requests',
  'Too many pairing attempts. Wait a moment and try again.',
);

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

function throughTunnel(visitor: string | undefined): Record<string, string> {
  return {
    host: tunnelHost,
    origin: tunnelPage,
    ...(visitor === undefined ? {} : { 'cf-connecting-ip': visitor }),
  };
}

function attempt(
  code: string,
  headers: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers,
    body: { code, platform: 'iOS' },
  };
}

function cookieOf(header: string | undefined) {
  const cookie = /porcelain_device=[^;]+/.exec(header ?? '')?.[0];
  if (!cookie) throw new Error('Pairing set no device cookie');
  return cookie;
}

export default defineFeature({
  feature: 'access.tunnel-visitors',
  reaches: ['POST /api/pair', 'GET /api/inventory'],
  paired: false,
  intent: 'intended',
  behaviour:
    "Cloudflare serves the tunnel's public hostname over HTTPS only and hands each request to this server over plain HTTP on the loopback listener, naming the visitor in Cf-Connecting-IP. A request for the tunnel hostname is therefore treated as secure, and a device paired through it is bound to the tunnel: the device cookie it sets or refreshes is marked Secure, and the answer tells the browser to reach that hostname over HTTPS only. The visitor Cloudflare names is the client for the pairing attempt allowance, so one visitor who exhausts it does not lock out another; that header is trusted only on a request for the tunnel hostname that arrived on the loopback listener and is ignored on any other.",
  cases: [
    defineCase({
      name: 'a browser that pairs through the tunnel keeps a secure cookie',
      async setup(session) {
        await tunnelOn(session);
        return issuePairing(session, 'Phone');
      },
      request: (_session, code) => ({
        ...attempt(code, {
          ...throughTunnel(undefined),
          'x-porcelain-browser': '1',
        }),
      }),
      expect({ response, check, checkPartial, checkMatch }) {
        check('status', 200, response.status);
        checkPartial(
          'the paired device',
          { label: 'Phone', platform: 'iOS' },
          record(response.body).device,
        );
        checkMatch(
          'the cookie is for HTTPS only',
          secureCookieForm,
          response.headers['set-cookie'],
        );
        check(
          'HTTPS only from now on',
          strictTransport,
          response.headers['strict-transport-security'],
        );
      },
    }),
    defineCase({
      name: 'the cookie a tunnel visitor sends back stays for HTTPS only and works only through the tunnel',
      async setup(session) {
        const paired = await session.read({
          ...attempt(await issuePairing(session, 'Tablet'), {
            ...throughTunnel(undefined),
            'x-porcelain-browser': '1',
          }),
        });
        return cookieOf(paired.headers['set-cookie']);
      },
      request: (_session, cookie) => [
        {
          method: 'GET',
          path: '/api/inventory',
          auth: { cookie },
          headers: throughTunnel(undefined),
        },
        { method: 'GET', path: '/api/inventory', auth: { cookie } },
      ],
      expect({ responses, check, checkContract, checkMatch }) {
        const [tunnelRead, directRead] = responses;
        check('read through the tunnel status', 200, tunnelRead?.status);
        checkContract(
          'read through the tunnel body',
          readInventoryResponseSchema,
          tunnelRead?.body,
        );
        checkMatch(
          'the refreshed cookie is for HTTPS only',
          secureCookieForm,
          tunnelRead?.headers['set-cookie'],
        );
        check(
          'HTTPS only through the tunnel',
          strictTransport,
          tunnelRead?.headers['strict-transport-security'],
        );
        check(
          'refused on the loopback listener status',
          401,
          directRead?.status,
        );
        check(
          'refused on the loopback listener body',
          unauthenticated,
          directRead?.body,
        );
        check(
          'no cookie refreshed on the loopback listener',
          undefined,
          directRead?.headers['set-cookie'],
        );
      },
    }),
    defineCase({
      name: 'each tunnel visitor has its own pairing allowance',
      setup: tunnelOn,
      request: () => [
        ...Array.from({ length: 10 }, () =>
          attempt('pcp_wrong', throughTunnel('203.0.113.7')),
        ),
        attempt('pcp_wrong', throughTunnel('203.0.113.7')),
        attempt('pcp_wrong', throughTunnel('198.51.100.2')),
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 10).entries()) {
          check(`failure ${index + 1} status`, 401, response.status);
          check(`failure ${index + 1} body`, invalidLink, response.body);
        }
        check('that visitor is limited status', 429, responses[10]?.status);
        check('that visitor is limited body', limited, responses[10]?.body);
        check('another visitor status', 401, responses[11]?.status);
        check('another visitor body', invalidLink, responses[11]?.body);
      },
    }),
    defineCase({
      name: 'a visitor address is ignored off the tunnel',
      request: () => [
        ...Array.from({ length: 10 }, (_, index) =>
          attempt('pcp_wrong', { 'cf-connecting-ip': `192.0.2.${index + 1}` }),
        ),
        attempt('pcp_wrong', { 'cf-connecting-ip': '192.0.2.99' }),
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 10).entries()) {
          check(`failure ${index + 1} status`, 401, response.status);
          check(`failure ${index + 1} body`, invalidLink, response.body);
        }
        check(
          'the loopback peer is limited status',
          429,
          responses[10]?.status,
        );
        check(
          'the loopback peer is limited body',
          limited,
          responses[10]?.body,
        );
      },
    }),
  ],
});

import * as Schema from 'effect/Schema';
import {
  issuePairingResponseSchema,
  readRemoteAccessResponseSchema,
  setRemoteAccessResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { eventually } from '../kit/reads.ts';
import { issuePairing, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  record,
  text,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const TUNNEL_HOST = 'porcelain.example.com';
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const notAnswered = apiError(
  403,
  'Forbidden',
  `This server does not answer to the host ${TUNNEL_HOST}`,
);
const remoteAccess: HttpRequest = { method: 'GET', path: '/api/remote-access' };
const fixtureNetwork = {
  interfaceName: 'eth0',
  subnet: '192.168.1.0/24',
  gateway: '192.168.1.1',
  gatewayHardware: '02:00:5e:10:00:01',
};
const TAILNET_HOST = 'porcelain.tail0000.ts.net';
const throughTailnet: HttpRequest = {
  method: 'GET',
  path: '/api/health',
  auth: 'none',
  headers: { host: TAILNET_HOST },
};
const throughTunnel: HttpRequest = {
  method: 'GET',
  path: '/api/health',
  auth: 'none',
  headers: { host: TUNNEL_HOST },
};

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

test('every way in is off at first and the local network the computer is on is reported', async ({
  session,
}) => {
  const response = await session.send(remoteAccess);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readRemoteAccessResponseSchema),
      ),
    ),
  );
  const off = { enabled: false, status: { kind: 'off' } };
  expect(response.body).toStrictEqual({
    routes: { lan: off, tailnet: off, cloudflare: off },
    localNetwork: fixtureNetwork,
    serviceUrl: session.address,
  });
});

test('changing the ways in with invalid input, a missing or unreadable hostname or a missing or foreign Tailscale name is refused and changes nothing', async ({
  session,
}) => {
  const before = await read(session, remoteAccess);

  const empty = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: {},
  });
  const malformed = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { lan: 'yes' },
  });
  const missingHostname = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true },
  });
  const unreadableHostname = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: {
      cloudflare: true,
      cloudflareHostname: 'http://x.example.com',
    },
  });
  const missingTailscaleName = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { tailnet: true },
  });
  const foreignTailscaleName = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { tailnet: true, tailnetHostname: 'porcelain.example.com' },
  });

  for (const response of [empty, malformed]) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(missingHostname.status).toBe(400);
  expect(missingHostname.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'Cloudflare needs the public hostname your tunnel serves.',
    ),
  );
  expect(unreadableHostname.status).toBe(400);
  expect(unreadableHostname.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'Enter the public hostname your Cloudflare tunnel serves, such as porcelain.example.com.',
    ),
  );
  expect(missingTailscaleName.status).toBe(400);
  expect(missingTailscaleName.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      "Tailscale needs this computer's Tailscale name.",
    ),
  );
  expect(foreignTailscaleName.status).toBe(400);
  expect(foreignTailscaleName.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      "Enter this computer's Tailscale name, such as laptop.tail1234.ts.net.",
    ),
  );
  expect(await read(session, remoteAccess)).toStrictEqual(before);
});

test('turning on the local network and the tailnet serves the private address and the Tailscale name, which pairing links can name', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: {
      lan: true,
      tailnet: true,
      tailnetHostname: 'Porcelain.Tail0000.ts.net',
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(setRemoteAccessResponseSchema),
      ),
    ),
  );
  const starting = { enabled: true, status: { kind: 'starting' } };
  expect(routes(record(response.body)).lan).toStrictEqual(starting);
  expect(routes(record(response.body)).tailnet).toStrictEqual(starting);
  expect(record(response.body).lanNetwork).toStrictEqual(fixtureNetwork);
  expect(record(response.body).tailnetHostname).toBe(TAILNET_HOST);
  const opened = await settled(session, 'lan', 'on');
  const settledTailnet = await settled(session, 'tailnet', '');
  expect([status(opened, 'lan').urls].flat()).toHaveLength(1);
  expect([status(opened, 'lan').urls].flat()[0]).toMatch(
    /^http:\/\/192\.168\.1\.20:\d+$/,
  );
  expect(status(settledTailnet, 'tailnet')).toStrictEqual({
    kind: 'on',
    urls: [`https://${TAILNET_HOST}`],
  });
  expect(settledTailnet.tailnetTarget).toBe('http://127.0.0.1:41000');
  const link = await read(session, {
    method: 'POST',
    path: '/api/pairings',
    body: {
      labels: ['Phone'],
      addresses: [status(opened, 'lan').urls].flat(),
    },
  });
  expect(link).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(issuePairingResponseSchema)),
    ),
  );
  const tailnetLink = await read(session, {
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Tablet'], addresses: [`https://${TAILNET_HOST}`] },
  });
  expect(
    record(record([tailnetLink.grants].flat()[0]).grant).addresses,
  ).toStrictEqual([`https://${TAILNET_HOST}`]);
  const mainListener = await session.send(throughTailnet);
  expect(mainListener.status).toBe(403);
  expect(mainListener.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      `This server does not answer to the host ${TAILNET_HOST}`,
    ),
  );
});

test('turning the local network off saves it off, closes the route and stops pairing links naming its address', async ({
  session,
}) => {
  const before = await settled(session, 'lan', 'on');

  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { lan: false },
  });

  expect(response.status).toBe(200);
  expect(routes(record(response.body)).lan).toStrictEqual({
    enabled: false,
    status: status(before, 'lan'),
  });
  expect(routes(await settled(session, 'lan', 'off')).lan).toStrictEqual({
    enabled: false,
    status: { kind: 'off' },
  });
  const refused = await session.send({
    method: 'POST',
    path: '/api/pairings',
    body: {
      labels: ['Phone'],
      addresses: [status(before, 'lan').urls].flat(),
    },
  });
  expect(refused.status).toBe(400);
  expect(refused.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'This server does not answer at that address, so a link aimed there would not reach it.',
    ),
  );
});

test('turning the tailnet off stops the route, keeps the Tailscale name, names no listener and refuses the name', async ({
  session,
}) => {
  const before = await settled(session, 'tailnet', 'on');

  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { tailnet: false },
  });

  expect(response.status).toBe(200);
  expect(routes(record(response.body)).tailnet).toStrictEqual({
    enabled: false,
    status: status(before, 'tailnet'),
  });
  const stopped = await settled(session, 'tailnet', 'off');
  expect(routes(stopped).tailnet).toStrictEqual({
    enabled: false,
    status: { kind: 'off' },
  });
  expect(stopped.tailnetHostname).toBe(TAILNET_HOST);
  expect(Object.keys(stopped)).toStrictEqual([
    'routes',
    'localNetwork',
    'tailnetHostname',
    'serviceUrl',
  ]);
  const refused = await session.send(throughTailnet);
  expect(refused.status).toBe(403);
  expect(refused.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      `This server does not answer to the host ${TAILNET_HOST}`,
    ),
  );
});

test('the tunnel hostname is answered only while Cloudflare is on and pairing links can name it', async ({
  session,
}) => {
  const refusedBefore = await session.send(throughTunnel);
  const turnedOn = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: {
      cloudflare: true,
      cloudflareHostname: `https://${TUNNEL_HOST}/`,
    },
  });
  const answered = await session.send(throughTunnel);

  expect(refusedBefore.status).toBe(403);
  expect(refusedBefore.body).toStrictEqual(notAnswered);
  expect(turnedOn.status).toBe(200);
  expect(record(turnedOn.body).cloudflareHostname).toBe(TUNNEL_HOST);
  expect(routes(record(turnedOn.body)).cloudflare).toStrictEqual({
    enabled: true,
    status: { kind: 'starting' },
  });
  expect(answered.status).toBe(200);
  expect(record(answered.body).status).toBe('ok');
  expect(
    status(await settled(session, 'cloudflare', 'on'), 'cloudflare'),
  ).toStrictEqual({ kind: 'on', urls: [`https://${TUNNEL_HOST}`] });
  const link = await read(session, {
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Phone'], addresses: [`https://${TUNNEL_HOST}`] },
  });
  expect(record(record([link.grants].flat()[0]).grant).addresses).toStrictEqual(
    [`https://${TUNNEL_HOST}`],
  );
});

test('a device paired through a route or a relayed request cannot change or read the ways in', async ({
  session,
}) => {
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` },
    body: { code: await issuePairing(session, 'Phone'), platform: 'iOS' },
  });
  const before = await read(session, remoteAccess);
  const bearer = text(paired.credential);

  const responses = [
    await session.send({
      method: 'PATCH',
      path: '/api/remote-access',
      auth: { bearer },
      headers: { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` },
      body: { lan: true },
    }),
    await session.send({
      method: 'GET',
      path: '/api/remote-access',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual(notOnThisComputer);
  }
  expect(await read(session, remoteAccess)).toStrictEqual(before);
});

test('turning Cloudflare off keeps the hostname, refuses it again and closes the route', async ({
  session,
}) => {
  const turnedOff = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: false },
  });
  const refused = await session.send(throughTunnel);

  expect(turnedOff.status).toBe(200);
  expect(record(turnedOff.body).cloudflareHostname).toBe(TUNNEL_HOST);
  expect(refused.status).toBe(403);
  expect(refused.body).toStrictEqual(notAnswered);
  expect(
    routes(await settled(session, 'cloudflare', 'off')).cloudflare,
  ).toStrictEqual({ enabled: false, status: { kind: 'off' } });
});

test('a tunnel hostname nothing answers at fails the tunnel as unreachable', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true, cloudflareHostname: 'porcelain.invalid' },
  });

  expect(response.status).toBe(200);
  expect(status(record(response.body), 'cloudflare')).toStrictEqual({
    kind: 'starting',
  });
  expect(
    status(await settled(session, 'cloudflare', 'failed'), 'cloudflare'),
  ).toStrictEqual({ kind: 'failed', reason: 'unreachable' });
});

test('a Tailscale name nothing answers at fails the tailnet as unreachable', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { tailnet: true, tailnetHostname: 'porcelain.invalid.ts.net' },
  });

  expect(response.status).toBe(200);
  expect(status(record(response.body), 'tailnet')).toStrictEqual({
    kind: 'starting',
  });
  expect(
    status(await settled(session, 'tailnet', 'failed'), 'tailnet'),
  ).toStrictEqual({ kind: 'failed', reason: 'unreachable' });
});

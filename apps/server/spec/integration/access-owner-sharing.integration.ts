import {
  readRemoteAccessResponseSchema,
  setRemoteAccessResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { eventually } from '../kit/reads.ts';
import { read, owner } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

const TAILNET_HOST = 'porcelain.tail0000.ts.net';
function status(body: Record<string, unknown>, route: string) {
  return record(record(record(body.routes)[route]).status);
}

async function settled(session: Session, route: string, kind: string) {
  return eventually(session, remoteAccess, (body) => {
    const current = status(body, route).kind;
    return current !== 'starting' && current === kind;
  });
}

const remoteAccess = owner({ method: 'GET', path: '/remote-access' });
const change = (body: unknown) =>
  owner({ method: 'PATCH', path: '/remote-access', body });

test('the owner reads every sharing route off at first, with the address the service answers at', async ({
  session,
}) => {
  const response = await session.send(remoteAccess);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readRemoteAccessResponseSchema),
  );
  const off = { enabled: false, status: { kind: 'off' } };
  expect(record(response.body).routes).toStrictEqual({
    lan: off,
    tailnet: off,
    cloudflare: off,
  });
  expect(record(response.body).serviceUrl).toBe(session.address);
});

test('the owner turns the local network and the tailnet on, and each comes up with its address', async ({
  session,
}) => {
  const response = await session.send(
    change({ lan: true, tailnet: true, tailnetHostname: TAILNET_HOST }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(setRemoteAccessResponseSchema),
  );
  expect(status(record(response.body), 'lan')).toStrictEqual({
    kind: 'starting',
  });
  const lan = await settled(session, 'lan', 'on');
  expect([status(lan, 'lan').urls].flat()[0]).toMatch(
    /^http:\/\/192\.168\.1\.20:\d+$/,
  );
  const tailnet = await settled(session, 'tailnet', 'on');
  expect(tailnet.tailnetTarget).toBe('http://127.0.0.1:41000');
});

test('turning an active route on again checks it again and it comes back at the same address', async ({
  session,
}) => {
  const before = await settled(session, 'lan', 'on');

  const response = await session.send(change({ lan: true }));

  expect(response.status).toBe(200);
  expect(record(record(response.body).routes).lan).toStrictEqual({
    enabled: true,
    status: { kind: 'starting' },
  });
  expect(status(await settled(session, 'lan', 'on'), 'lan')).toStrictEqual(
    status(before, 'lan'),
  );
});

test('the owner turns the local network off and the route closes', async ({
  session,
}) => {
  const response = await session.send(change({ lan: false }));

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    routes: { lan: { enabled: false } },
  });
  expect(status(await settled(session, 'lan', 'off'), 'lan')).toStrictEqual({
    kind: 'off',
  });
});

test('invalid sharing choices are refused and change nothing', async ({
  session,
}) => {
  const before = await read(session, remoteAccess);

  const empty = await session.send(change({}));
  const tailscaleName = await session.send(
    change({ tailnet: true, tailnetHostname: 'porcelain.example.com' }),
  );
  const cloudflareHostname = await session.send(change({ cloudflare: true }));

  expect(empty.status).toBe(400);
  expect(empty.body).toStrictEqual(invalidRequest);
  expect(tailscaleName.status).toBe(400);
  expect(tailscaleName.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      "Enter this computer's Tailscale name, such as laptop.tail1234.ts.net.",
    ),
  );
  expect(cloudflareHostname.status).toBe(400);
  expect(cloudflareHostname.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'Cloudflare needs the public hostname your tunnel serves.',
    ),
  );
  expect(await read(session, remoteAccess)).toStrictEqual(before);
});

test('the network listener answers the sharing read with the web shell, does not find the write, and changes nothing', async ({
  session,
}) => {
  const before = await read(session, remoteAccess);

  const reading = await session.send({ method: 'GET', path: '/remote-access' });
  const writing = await session.send({
    method: 'PATCH',
    path: '/remote-access',
    body: { lan: true },
  });

  expect(reading.status).toBe(200);
  expect(reading.body).toStrictEqual(session.fixture.web.shell);
  expect(writing.status).toBe(404);
  expect(writing.body).toStrictEqual(
    apiError(404, 'Not Found', 'Route PATCH:/remote-access not found'),
  );
  expect(await read(session, remoteAccess)).toStrictEqual(before);
});

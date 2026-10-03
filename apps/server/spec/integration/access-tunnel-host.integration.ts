import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { eventually } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type Session } from '../kit/session.ts';

const OTHER_SERVER_HOST = 'porcelain.elsewhere.test';
const SILENT_HOST = 'porcelain.invalid';
const remoteAccess: HttpRequest = { method: 'GET', path: '/api/remote-access' };

function health(host: string): HttpRequest {
  return {
    method: 'GET',
    path: '/api/health',
    auth: 'none',
    headers: { host },
  };
}

function tunnelStatus(body: Record<string, unknown>) {
  return record(record(record(body.routes).cloudflare).status);
}

async function checked(session: Session) {
  return eventually(
    session,
    remoteAccess,
    (body) => tunnelStatus(body).kind === 'failed',
  );
}

test('a tunnel hostname nothing answers at yet is still answered while the tunnel is checked and after', async ({
  session,
}) => {
  const turnedOn = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true, cloudflareHostname: SILENT_HOST },
  });
  const answered = await session.send(health(SILENT_HOST));

  expect(turnedOn.status).toBe(200);
  expect(tunnelStatus(record(turnedOn.body))).toStrictEqual({
    kind: 'starting',
  });
  expect(tunnelStatus(await checked(session))).toStrictEqual({
    kind: 'failed',
    reason: 'unreachable',
  });
  expect(answered.status).toBe(200);
  expect(record(answered.body).status).toBe('ok');
  const later = await session.send(health(SILENT_HOST));
  expect(later.status).toBe(200);
  expect(record(later.body).status).toBe('ok');
});

test('a tunnel hostname another server answers at is no longer answered once the check finds it', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true, cloudflareHostname: OTHER_SERVER_HOST },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).cloudflareHostname).toBe(OTHER_SERVER_HOST);
  expect(tunnelStatus(await checked(session))).toStrictEqual({
    kind: 'failed',
    reason: 'other-server',
  });
  const refused = await session.send(health(OTHER_SERVER_HOST));
  expect(refused.status).toBe(403);
  expect(refused.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      `This server does not answer to the host ${OTHER_SERVER_HOST}`,
    ),
  );
});

import {
  apiError,
  defineCase,
  defineFeature,
  record,
  type Session,
} from '../scripts/feature.ts';
import { eventually } from '../scripts/fixture.ts';

const otherServerHost = 'porcelain.elsewhere.test';
const silentHost = 'porcelain.invalid';
const remoteAccess = { method: 'GET', path: '/api/remote-access' } as const;

function health(host: string) {
  return {
    method: 'GET',
    path: '/api/health',
    auth: 'none',
    headers: { host },
  } as const;
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

export default defineFeature({
  feature: 'access.tunnel-host',
  reaches: ['PATCH /api/remote-access', 'GET /api/health'],
  paired: false,
  intent: 'intended',
  behaviour:
    "While Cloudflare is on, the server answers to the tunnel's public hostname, and it keeps answering while the tunnel is being checked or while nothing answers there yet, so a phone is not locked out while cloudflared is still starting. Once the check finds another server behind the hostname, the server stops answering to it, so the tunnel's traffic is never taken for this server's. The fixture's tunnel answers as another server for a hostname under .test and not at all for one under .invalid.",
  cases: [
    defineCase({
      name: 'a hostname nothing answers at yet is still answered',
      request: () => [
        {
          method: 'PATCH',
          path: '/api/remote-access',
          body: { cloudflare: true, cloudflareHostname: silentHost },
        },
        health(silentHost),
      ],
      async expect({ responses, session, check }) {
        check('turned on status', 200, responses[0]?.status);
        check(
          'checking the tunnel',
          { kind: 'starting' },
          tunnelStatus(record(responses[0]?.body)),
        );
        check(
          'nothing answers',
          { kind: 'failed', reason: 'unreachable' },
          tunnelStatus(await checked(session)),
        );
        check('answered status', 200, responses[1]?.status);
        check('answered body', 'ok', record(responses[1]?.body).status);
        const later = await session.send(health(silentHost));
        check('still answered status', 200, later.status);
        check('still answered body', 'ok', record(later.body).status);
      },
    }),
    defineCase({
      name: 'a hostname another server answers at is no longer answered',
      request: () => ({
        method: 'PATCH',
        path: '/api/remote-access',
        body: { cloudflare: true, cloudflareHostname: otherServerHost },
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'hostname saved',
          otherServerHost,
          record(response.body).cloudflareHostname,
        );
        check(
          'another server answers',
          { kind: 'failed', reason: 'other-server' },
          tunnelStatus(await checked(session)),
        );
        const refused = await session.send(health(otherServerHost));
        check('refused status', 403, refused.status);
        check(
          'refused body',
          apiError(
            403,
            'Forbidden',
            `This server does not answer to the host ${otherServerHost}`,
          ),
          refused.body,
        );
      },
    }),
  ],
});

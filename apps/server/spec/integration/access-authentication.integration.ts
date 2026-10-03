import { expect } from 'vitest';
import { unauthenticated, UNKNOWN_UUID, unknownOid } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import type { HttpRequest, Session } from '../kit/session.ts';

const unpairedRoutes = new Set([
  'DELETE /api/session',
  'GET /*',
  'GET /api/environment',
  'GET /api/health',
  'GET /api/live',
  'GET /review-summaries/:token',
  'POST /api/live/tickets',
  'POST /api/pair',
]);

const PAIRED_ROUTES = 57;

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function pairedRoutes(routes: readonly string[]) {
  return routes.filter(
    (route) => !route.startsWith('owner ') && !unpairedRoutes.has(route),
  );
}

function parameter(session: Session, name: string, route: string): string {
  if (name === 'projectId') return session.projectId;
  if (name === 'worktreeId') return session.worktreeId;
  if (name === 'oid') return unknownOid;
  if (name === 'threadId' || name === 'requestId') return UNKNOWN_UUID;
  throw new Error(`${route} has a parameter the sweep cannot fill: ${name}`);
}

function requestFor(
  session: Session,
  route: string,
  auth: NonNullable<HttpRequest['auth']>,
): HttpRequest {
  const [verb = '', template = ''] = route.split(' ');
  const method = methods.find((candidate) => candidate === verb);
  if (!method) throw new Error(`${route} has no HTTP method`);
  const path = template.replace(/:([A-Za-z]+)/g, (_match, name: string) =>
    parameter(session, name, route),
  );
  return {
    method,
    path,
    auth,
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }),
  };
}

test.for<{ credential: string; auth: NonNullable<HttpRequest['auth']> }>([
  { credential: 'no credential', auth: 'none' },
  {
    credential: 'an unknown bearer credential',
    auth: { bearer: 'pcd_00000000-0000-4000-8000-000000000000_unknown' },
  },
  {
    credential: 'an unknown device cookie',
    auth: { cookie: 'porcelain_device=pcd_unknown' },
  },
])(
  'every paired route refuses a request with $credential with a Bearer challenge and changes nothing',
  async ({ auth }, { session, server }) => {
    const before = await inventory(session);
    const routes = pairedRoutes(server.routes);
    const answers = [];
    expect(routes).toHaveLength(PAIRED_ROUTES);

    for (const route of routes) {
      const response = await session.send(requestFor(session, route, auth));
      answers.push({
        route,
        status: response.status,
        body: response.body,
        challenge: response.headers['www-authenticate'],
      });
    }

    expect(answers).toStrictEqual(
      routes.map((route) => ({
        route,
        status: 401,
        body: unauthenticated,
        challenge: 'Bearer',
      })),
    );
    expect(await inventory(session)).toStrictEqual(before);
  },
);

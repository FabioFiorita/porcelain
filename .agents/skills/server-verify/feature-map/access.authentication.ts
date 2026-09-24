import {
  defineCase,
  defineFeature,
  unauthenticated,
  unknownOid,
  unknownUuid,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import { loadFeatures, reachesOf } from '../scripts/catalogue.ts';
import { inventory } from '../scripts/fixture.ts';

const pairedRoutes = [
  ...new Set(
    (await loadFeatures(import.meta.url))
      .filter((feature) => feature.paired)
      .flatMap(reachesOf),
  ),
];

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function parameter(session: Session, name: string, route: string): string {
  if (name === 'projectId') return session.projectId;
  if (name === 'worktreeId') return session.worktreeId;
  if (name === 'oid') return unknownOid;
  if (name === 'threadId' || name === 'requestId') return unknownUuid;
  throw new Error(`${route} has a parameter the sweep cannot fill: ${name}`);
}

function requests(
  session: Session,
  auth: NonNullable<HttpRequest['auth']>,
): HttpRequest[] {
  return pairedRoutes.map((route) => {
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
  });
}

function refused(name: string, auth: NonNullable<HttpRequest['auth']>) {
  return defineCase({
    name,
    setup: inventory,
    request: (session) => requests(session, auth),
    async expect({ responses, state, session, check }) {
      for (const [index, response] of responses.entries()) {
        const route = pairedRoutes[index];
        check(`${route} status`, 401, response.status);
        check(`${route} error body`, unauthenticated, response.body);
        check(
          `${route} challenge`,
          'Bearer',
          response.headers['www-authenticate'],
        );
      }
      check('nothing changed', state, await inventory(session));
    },
  });
}

export default defineFeature({
  feature: 'access.authentication',
  reaches: pairedRoutes,
  paired: false,
  intent: 'observed',
  behaviour:
    'Every paired route, which is every route of a feature that declares itself paired, refuses a request that carries no credential, an unknown bearer credential or an unknown device cookie, before it reads input or touches state, with the same 401 body and a Bearer challenge. `/api/live` authenticates on its own and is covered by access.live-updates.',
  cases: [
    refused('no credential', 'none'),
    refused('unknown bearer credential', {
      bearer: 'pcd_00000000-0000-4000-8000-000000000000_unknown',
    }),
    refused('unknown device cookie', {
      cookie: 'porcelain_device=pcd_unknown',
    }),
  ],
});

import {
  defineCase,
  defineFeature,
  unauthenticated,
  unknownOid,
  unknownUuid,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import { inventory } from '../scripts/fixture.ts';

const pairedRoutes = [
  'GET /api/inventory',
  'POST /api/projects',
  'PATCH /api/projects/:projectId',
  'DELETE /api/projects/:projectId',
  'GET /api/projects/discover',
  'GET /api/projects/folders',
  'GET /api/projects/:projectId/file-preferences',
  'PUT /api/projects/:projectId/file-preferences',
  'GET /api/worktrees/:worktreeId/changes',
  'POST /api/worktrees/:worktreeId/changes/diffs',
  'GET /api/worktrees/:worktreeId/changes/lines',
  'GET /api/worktrees/:worktreeId/git/status',
  'GET /api/worktrees/:worktreeId/commits',
  'GET /api/worktrees/:worktreeId/commits/:oid/files',
  'POST /api/worktrees/:worktreeId/commits/:oid/diffs',
  'GET /api/worktrees/:worktreeId/directory',
  'GET /api/worktrees/:worktreeId/text',
  'GET /api/worktrees/:worktreeId/asset',
  'POST /api/worktrees/:worktreeId/preview-assets',
  'POST /api/worktrees/:worktreeId/files',
  'GET /api/worktrees/:worktreeId/paths',
  'GET /api/worktrees/:worktreeId/comments',
  'POST /api/worktrees/:worktreeId/comments',
  'POST /api/worktrees/:worktreeId/comments/:threadId/replies',
  'PUT /api/worktrees/:worktreeId/comments/:threadId/resolution',
  'POST /api/worktrees/:worktreeId/comments/seen',
  'GET /api/worktrees/:worktreeId/reviewed',
  'PUT /api/worktrees/:worktreeId/reviewed',
  'PUT /api/worktrees/:worktreeId/reviewed-bulk',
  'DELETE /api/worktrees/:worktreeId/reviewed',
  'GET /api/worktrees/:worktreeId/reviewed-layers',
  'PUT /api/worktrees/:worktreeId/reviewed-layers',
  'DELETE /api/worktrees/:worktreeId/reviewed-layers',
  'GET /api/worktrees/:worktreeId/review',
  'PUT /api/worktrees/:worktreeId/review',
  'GET /api/projects/:projectId/worktrees/:worktreeId/git/branches',
  'GET /api/git/commit-models',
  'POST /api/projects/:projectId/worktrees/:worktreeId/git/commit-draft',
  'POST /api/projects/:projectId/worktrees/:worktreeId/git/actions',
  'GET /api/git-action-requests/:requestId',
  'DELETE /api/projects/:projectId/worktrees/:worktreeId/git/interrupted/:requestId',
] as const;

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function requests(
  session: Session,
  auth: NonNullable<HttpRequest['auth']>,
): HttpRequest[] {
  return pairedRoutes.map((route) => {
    const [verb = '', template = ''] = route.split(' ');
    const method = methods.find((candidate) => candidate === verb);
    if (!method) throw new Error(`${route} has no HTTP method`);
    const path = template
      .replace(':projectId', session.projectId)
      .replace(':worktreeId', session.worktreeId)
      .replace(':oid', unknownOid)
      .replace(':threadId', unknownUuid)
      .replace(':requestId', unknownUuid);
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
  intent: 'observed',
  behaviour:
    'Every paired route refuses a request that carries no credential, an unknown bearer credential or an unknown device cookie, before it reads input or touches state, with the same 401 body and a Bearer challenge. `/api/session` and `/api/live` authenticate on their own and are covered by access.session and access.live-updates.',
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

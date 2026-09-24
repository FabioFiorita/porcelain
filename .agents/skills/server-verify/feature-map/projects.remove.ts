import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownUuid,
  type Session,
} from '../scripts/feature.ts';

async function inventory(session: Session) {
  return record(
    (await session.send({ method: 'GET', path: '/api/inventory' })).body,
  );
}

export default defineFeature({
  feature: 'projects.remove',
  reaches: 'DELETE /api/projects/:projectId',
  intent: 'intended',
  locations: [
    'apps/server/src/http/routes/projects/remove.ts',
    'packages/contracts/src/projects/inventory.ts',
    'apps/server/src/use-cases/projects/remove-project.ts',
    'packages/projects/src/services/remove-project-service.ts',
    'packages/projects/src/services/forget-project-worktrees-service.ts',
    'packages/projects/src/ports/project-removal-store.ts',
    'packages/storage/src/repositories/projects/project-removal-repository.ts',
  ],
  behaviour:
    'The paired owner removes one registered project. Removal deletes the project and its dependent records, forgets its worktrees and reports whether anything was deleted; removing an unknown or already removed project is not an error. Database rows, restart and the live notification are not asserted yet.',
  cases: [
    defineCase({
      name: 'invalid project ID',
      setup: inventory,
      request: () => ({ method: 'DELETE', path: '/api/projects/not-a-uuid' }),
      async expect({ response, state, session, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
        check('inventory unchanged', state, await inventory(session));
      },
    }),
    defineCase({
      name: 'unknown project',
      setup: inventory,
      request: () => ({
        method: 'DELETE',
        path: `/api/projects/${unknownUuid}`,
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check('response', { deleted: false }, response.body);
        check('inventory unchanged', state, await inventory(session));
      },
    }),
    defineCase({
      name: 'existing project',
      request: (session) => ({
        method: 'DELETE',
        path: `/api/projects/${session.projectId}`,
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check('response', { deleted: true }, response.body);
        check(
          'project is absent from inventory',
          [],
          list((await inventory(session)).projects),
        );
      },
    }),
    defineCase({
      name: 'already removed project',
      request: (session) => ({
        method: 'DELETE',
        path: `/api/projects/${session.projectId}`,
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check('response', { deleted: false }, response.body);
        check(
          'inventory remains empty',
          [],
          list((await inventory(session)).projects),
        );
      },
    }),
  ],
});

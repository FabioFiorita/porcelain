import {
  apiError,
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

function rejectedName(name: string, submitted: string, projectId?: string) {
  return defineCase({
    name,
    setup: inventory,
    request: (session) => ({
      method: 'PATCH',
      path: `/api/projects/${projectId ?? session.projectId}`,
      body: { name: submitted },
    }),
    async expect({ response, state, session, check }) {
      check('status', 400, response.status);
      check('error body', invalidRequest, response.body);
      check('inventory unchanged', state, await inventory(session));
    },
  });
}

export default defineFeature({
  feature: 'projects.rename',
  reaches: 'PATCH /api/projects/:projectId',
  intent: 'intended',
  locations: [
    'apps/server/src/http/routes/projects/rename.ts',
    'packages/contracts/src/projects/inventory.ts',
    'apps/server/src/use-cases/projects/rename-project.ts',
    'packages/projects/src/services/rename-project-service.ts',
    'packages/storage/src/repositories/projects/sqlite-inventory-store.ts',
  ],
  behaviour:
    "The owner gives a registered project a new display name without changing the project's identity, worktrees or other projects. The name is trimmed and must be 1 to 100 characters with no control characters. Duplicate display names are allowed and not asserted. Restart persistence and the inventory-change notification are deferred.",
  cases: [
    defineCase({
      name: 'existing project',
      setup: inventory,
      request: (session) => ({
        method: 'PATCH',
        path: `/api/projects/${session.projectId}`,
        body: { name: '  New name  ' },
      }),
      async expect({ response, state, session, check }) {
        check(
          'fixture has one registered project',
          1,
          list(state.projects).length,
        );
        check('status', 200, response.status);
        check(
          'response',
          { id: session.projectId, name: 'New name' },
          response.body,
        );
        check(
          'inventory changes only the project name',
          {
            ...state,
            projects: list(state.projects).map((entry) =>
              record(entry).id === session.projectId
                ? { ...record(entry), name: 'New name' }
                : entry,
            ),
          },
          await inventory(session),
        );
      },
    }),
    defineCase({
      name: 'unknown project',
      setup: inventory,
      request: () => ({
        method: 'PATCH',
        path: `/api/projects/${unknownUuid}`,
        body: { name: 'Ghost' },
      }),
      async expect({ response, state, session, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Project not found'),
          response.body,
        );
        check('inventory unchanged', state, await inventory(session));
      },
    }),
    rejectedName('empty name', ''),
    rejectedName('whitespace-only name', '   '),
    rejectedName('name over 100 characters', 'x'.repeat(101)),
    rejectedName('control character in name', 'Line\nbreak'),
    rejectedName('invalid project ID', 'Valid name', 'not-a-uuid'),
  ],
});

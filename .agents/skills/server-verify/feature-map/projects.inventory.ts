import { rename } from 'node:fs/promises';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  defineCase,
  defineFeature,
  list,
  record,
  type Session,
} from '../scripts/feature.ts';

const registered = (session: Session, available: boolean) => ({
  id: session.projectId,
  name: session.fixture.folders.repository,
  available,
  worktrees: [
    {
      id: session.worktreeId,
      path: session.repository,
      main: true,
      branch: `refs/heads/${session.fixture.branch}`,
      available,
      status: null,
    },
  ],
});

export default defineFeature({
  feature: 'projects.inventory',
  reaches: 'GET /api/inventory',
  paired: true,
  intent: 'observed',
  behaviour:
    "A paired client reads the inventory: the server's environment and every registered project with its availability and worktrees. Each worktree reports its path, whether it is the main checkout, its branch ref, availability and review status (null until a review is published). A project whose folder has gone away stays registered and is reported unavailable, with its worktrees, until the folder is back.",
  cases: [
    defineCase({
      name: 'registered sample repository',
      request: () => ({ method: 'GET', path: '/api/inventory' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readInventoryResponseSchema, response.body);
        check('not cacheable', 'no-store', response.headers['cache-control']);
        check(
          'projects',
          [registered(session, true)],
          list(record(response.body).projects),
        );
      },
    }),
    defineCase({
      name: 'a project whose folder has gone away',
      async setup(session) {
        const moved = `${session.repository}-moved`;
        await rename(session.repository, moved);
        return moved;
      },
      request: () => ({ method: 'GET', path: '/api/inventory' }),
      async expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readInventoryResponseSchema, response.body);
        check(
          'projects',
          [registered(session, false)],
          list(record(response.body).projects),
        );
        await rename(state, session.repository);
        check(
          'available again once the folder is back',
          [registered(session, true)],
          list(
            record(
              (await session.send({ method: 'GET', path: '/api/inventory' }))
                .body,
            ).projects,
          ),
        );
      },
    }),
  ],
});

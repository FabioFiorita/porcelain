import { readInventoryResponseSchema } from '../../../../packages/contracts/src/projects/index.ts';
import {
  defineCase,
  defineFeature,
  list,
  record,
  unauthenticated,
} from '../scripts/feature.ts';

export default defineFeature({
  feature: 'projects.inventory',
  reaches: 'GET /api/inventory',
  intent: 'observed',
  behaviour:
    "A paired client reads the inventory: the server's environment and every registered project with its availability and worktrees. Each worktree reports its path, whether it is the main checkout, its branch ref, availability and review status (null until a review is published).",
  cases: [
    defineCase({
      name: 'registered sample repository',
      request: () => ({ method: 'GET', path: '/api/inventory' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readInventoryResponseSchema, response.body);
        check('not cacheable', 'no-store', response.headers['cache-control']);
        const projects = list(record(response.body).projects);
        check('one project', 1, projects.length);
        check(
          'project',
          {
            id: session.projectId,
            name: 'repository',
            available: true,
            worktrees: [
              {
                id: session.worktreeId,
                path: session.repository,
                main: true,
                branch: 'refs/heads/main',
                available: true,
                status: null,
              },
            ],
          },
          projects[0],
        );
      },
    }),
    defineCase({
      name: 'without a credential',
      request: () => ({ method: 'GET', path: '/api/inventory', auth: 'none' }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
      },
    }),
  ],
});

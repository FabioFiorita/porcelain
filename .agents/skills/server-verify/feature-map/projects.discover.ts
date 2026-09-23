import { discoverProjectsResponseSchema } from '../../../../packages/contracts/src/projects/index.ts';
import {
  defineCase,
  defineFeature,
  unauthenticated,
} from '../scripts/feature.ts';

export default defineFeature({
  feature: 'projects.discover',
  reaches: 'GET /api/projects/discover',
  intent: 'observed',
  behaviour:
    'The owner asks for Git repositories found under the project home, to pick one to register. Registered repositories are still listed. The answer says whether the search was cut short.',
  cases: [
    defineCase({
      name: 'repositories under the project home',
      async setup(session) {
        await session.git('init', `${session.projectHome}/unregistered`);
      },
      request: () => ({ method: 'GET', path: '/api/projects/discover' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          discoverProjectsResponseSchema,
          response.body,
        );
        check(
          'body',
          {
            repositories: [
              { name: 'repository', path: session.repository },
              {
                name: 'unregistered',
                path: `${session.projectHome}/unregistered`,
              },
            ],
            limited: false,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'without a credential',
      request: () => ({
        method: 'GET',
        path: '/api/projects/discover',
        auth: 'none',
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
      },
    }),
  ],
});

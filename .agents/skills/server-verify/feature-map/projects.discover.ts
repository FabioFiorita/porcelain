import { discoverProjectsResponseSchema } from '@porcelain/contracts/projects';
import { defineCase, defineFeature } from '../scripts/feature.ts';

export default defineFeature({
  feature: 'projects.discover',
  reaches: 'GET /api/projects/discover',
  paired: true,
  intent: 'observed',
  behaviour:
    'The owner asks for Git repositories found under the project home, to pick one to register. Registered repositories are still listed. Hidden folders, dependency and build folders (node_modules, vendor, dist, build, target) and folders more than three levels down are not searched. The answer says whether the search was cut short, which it was when folders were left below that depth.',
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
              {
                name: session.fixture.folders.repository,
                path: session.repository,
              },
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
      name: 'hidden, skipped and deep folders are not searched',
      async setup(session) {
        const home = session.projectHome;
        for (const path of [
          '.hidden/repository',
          'node_modules/package',
          'build/output',
          'one/two/three/deep',
          'one/two/shallow',
        ])
          await session.git('init', `${home}/${path}`);
      },
      request: () => ({ method: 'GET', path: '/api/projects/discover' }),
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'body',
          {
            repositories: [
              {
                name: session.fixture.folders.repository,
                path: session.repository,
              },
              {
                name: 'shallow',
                path: `${session.projectHome}/one/two/shallow`,
              },
              {
                name: 'unregistered',
                path: `${session.projectHome}/unregistered`,
              },
            ],
            limited: true,
          },
          response.body,
        );
      },
    }),
  ],
});

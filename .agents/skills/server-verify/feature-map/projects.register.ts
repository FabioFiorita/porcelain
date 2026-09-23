import { registerProjectResponseSchema } from '../../../../packages/contracts/src/projects/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
} from '../scripts/feature.ts';

const byText = (left: string, right: string) => left.localeCompare(right);
import { inventory } from '../scripts/fixture.ts';

const uninspectable = apiError(
  422,
  'Unprocessable Entity',
  'Repository could not be inspected',
);

export default defineFeature({
  feature: 'projects.register',
  reaches: 'POST /api/projects',
  intent: 'observed',
  behaviour:
    'The owner registers a Git repository by its absolute path. The project is named after the folder and lists its worktrees. Registering an already registered repository returns the existing project instead of a duplicate. A relative path is invalid input; a missing folder or a folder that is not a repository cannot be inspected.',
  cases: [
    defineCase({
      name: 'a second repository',
      async setup(session) {
        const path = `${session.projectHome}/second`;
        await session.git('init', '-b', 'trunk', path);
        return path;
      },
      request: (_session, path) => ({
        method: 'POST',
        path: '/api/projects',
        body: { path },
      }),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
        check('status', 200, response.status);
        checkContract('contract', registerProjectResponseSchema, response.body);
        checkPartial(
          'project',
          {
            name: 'second',
            available: true,
            worktrees: [
              {
                path: state,
                main: true,
                branch: 'refs/heads/trunk',
                available: true,
                status: null,
              },
            ],
          },
          response.body,
        );
        const projects = list((await inventory(session)).projects).map(
          (entry) => record(entry).id,
        );
        check(
          'inventory lists both projects',
          [session.projectId, text(record(response.body).id)].sort(byText),
          projects.map(text).sort(byText),
        );
      },
    }),
    defineCase({
      name: 'already registered repository',
      request: (session) => ({
        method: 'POST',
        path: '/api/projects',
        body: { path: session.repository },
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check('same project', session.projectId, record(response.body).id);
        check(
          'no duplicate',
          2,
          list((await inventory(session)).projects).length,
        );
      },
    }),
    defineCase({
      name: 'invalid input',
      request: () => [
        {
          method: 'POST',
          path: '/api/projects',
          body: { path: 'relative/folder' },
        },
        { method: 'POST', path: '/api/projects', body: {} },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'missing folder or not a repository',
      setup: inventory,
      request: (session) => [
        {
          method: 'POST',
          path: '/api/projects',
          body: { path: `${session.projectHome}/missing` },
        },
        {
          method: 'POST',
          path: '/api/projects',
          body: { path: `${session.projectHome}/home` },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 422, response.status);
          check(
            `request ${index + 1} error body`,
            uninspectable,
            response.body,
          );
        }
        check('inventory unchanged', state, await inventory(session));
      },
    }),
  ],
});

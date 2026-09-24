import { browseProjectFoldersResponseSchema } from '@porcelain/contracts/projects';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
} from '../scripts/feature.ts';

export default defineFeature({
  feature: 'projects.browse-folders',
  reaches: 'GET /api/projects/folders',
  paired: true,
  intent: 'observed',
  behaviour:
    'The owner browses folders to find a repository to register. Without a path the listing starts at the project home. Each listing names its parent, its subfolders, whether the folder itself is a repository and whether the listing was truncated. Any absolute path can be browsed; a relative path is invalid and a missing folder is not found.',
  cases: [
    defineCase({
      name: 'project home by default',
      request: () => ({ method: 'GET', path: '/api/projects/folders' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          browseProjectFoldersResponseSchema,
          response.body,
        );
        check(
          'body',
          {
            path: session.projectHome,
            parent:
              session.projectHome.slice(
                0,
                session.projectHome.lastIndexOf('/'),
              ) || '/',
            directories: Object.values(session.fixture.folders)
              .sort()
              .map((name) => ({
                name,
                path: `${session.projectHome}/${name}`,
              })),
            repository: false,
            truncated: false,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a repository folder',
      request: (session) => ({
        method: 'GET',
        path: '/api/projects/folders',
        query: { path: session.repository },
      }),
      expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'body',
          {
            path: session.repository,
            parent: session.projectHome,
            repository: true,
            directories: [],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a folder outside the project home',
      request: () => ({
        method: 'GET',
        path: '/api/projects/folders',
        query: { path: '/usr' },
      }),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'lists it',
          { path: '/usr', parent: '/', repository: false },
          response.body,
        );
        check(
          'lists its folders',
          [{ name: 'bin', path: '/usr/bin' }],
          list(record(response.body).directories).filter(
            (entry) => record(entry).path === '/usr/bin',
          ),
        );
      },
    }),
    defineCase({
      name: 'relative or missing path',
      request: (session) => [
        {
          method: 'GET',
          path: '/api/projects/folders',
          query: { path: 'relative' },
        },
        {
          method: 'GET',
          path: '/api/projects/folders',
          query: { path: `${session.projectHome}/missing` },
        },
      ],
      expect({ responses, check }) {
        check('relative status', 400, responses[0]?.status);
        check('relative error body', invalidRequest, responses[0]?.body);
        check('missing status', 404, responses[1]?.status);
        check(
          'missing error body',
          apiError(404, 'Not Found', 'Path not found'),
          responses[1]?.body,
        );
      },
    }),
  ],
});

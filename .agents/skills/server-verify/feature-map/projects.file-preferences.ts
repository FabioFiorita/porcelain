import { listFilePreferencesResponseSchema } from '@porcelain/contracts/projects';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownUuid,
} from '../scripts/feature.ts';
import { read } from '../scripts/fixture.ts';

const preferences = (projectId: string) =>
  `/api/projects/${projectId}/file-preferences`;
const notFound = apiError(404, 'Not Found', 'Project not found');

export default defineFeature({
  feature: 'projects.file-preferences',
  reaches: [
    'GET /api/projects/:projectId/file-preferences',
    'PUT /api/projects/:projectId/file-preferences',
  ],
  paired: true,
  intent: 'observed',
  behaviour:
    'Each project keeps per-path file preferences: pinned and hidden. Setting one flag keeps the other, and the answer is the full list. Paths are project-relative and need not exist. An unknown project is not found; a path that is not a normalized relative path is invalid.',
  cases: [
    defineCase({
      name: 'no preferences yet',
      request: (session) => ({
        method: 'GET',
        path: preferences(session.projectId),
      }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        check('body', { preferences: [] }, response.body);
        checkContract(
          'contract',
          listFilePreferencesResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'pin, hide and unpin',
      request: (session) => [
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: 'README.md', flag: 'pinned', value: true },
        },
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: 'README.md', flag: 'hidden', value: true },
        },
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: 'README.md', flag: 'pinned', value: false },
        },
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: 'docs/missing.md', flag: 'pinned', value: true },
        },
      ],
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [200, 200, 200, 200],
          responses.map((entry) => entry.status),
        );
        check(
          'pinned',
          { preferences: [{ path: 'README.md', pinned: true, hidden: false }] },
          responses[0]?.body,
        );
        check(
          'hidden keeps pinned',
          { preferences: [{ path: 'README.md', pinned: true, hidden: true }] },
          responses[1]?.body,
        );
        check(
          'unpinned keeps hidden',
          { preferences: [{ path: 'README.md', pinned: false, hidden: true }] },
          responses[2]?.body,
        );
        const expected = {
          preferences: [
            { path: 'README.md', pinned: false, hidden: true },
            { path: 'docs/missing.md', pinned: true, hidden: false },
          ],
        };
        check(
          'a path that does not exist is accepted',
          expected,
          responses[3]?.body,
        );
        check(
          'list reads the same',
          expected,
          await read(session, {
            method: 'GET',
            path: preferences(session.projectId),
          }),
        );
      },
    }),
    defineCase({
      name: 'unknown project',
      request: () => [
        { method: 'GET', path: preferences(unknownUuid) },
        {
          method: 'PUT',
          path: preferences(unknownUuid),
          body: { path: 'README.md', flag: 'pinned', value: true },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 404, response.status);
          check(`request ${index + 1} error body`, notFound, response.body);
        }
      },
    }),
    defineCase({
      name: 'invalid input',
      request: (session) => [
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: '../outside', flag: 'pinned', value: true },
        },
        {
          method: 'PUT',
          path: preferences(session.projectId),
          body: { path: 'README.md', flag: 'starred', value: true },
        },
        { method: 'GET', path: preferences('not-a-uuid') },
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
  ],
});

import { readFileAssetResponseSchema } from '../../../../packages/contracts/src/files/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const asset = (session: Session, path: string) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/asset'),
  query: { path },
});

export default defineFeature({
  feature: 'files.read-asset',
  reaches: 'GET /api/worktrees/:worktreeId/asset',
  intent: 'observed',
  behaviour:
    'A reviewer reads an image from the worktree to preview it: the answer carries its media type and base64 content. A file that is not a previewable image is refused as unreadable; a missing file is not found.',
  cases: [
    defineCase({
      name: 'an SVG image',
      setup: (session) => session.writeFile('logo.svg', svg),
      request: (session) => asset(session, 'logo.svg'),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readFileAssetResponseSchema, response.body);
        check(
          'body',
          {
            path: 'logo.svg',
            mediaType: 'image/svg+xml',
            base64: Buffer.from(svg).toString('base64'),
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a file that is not an image',
      request: (session) => asset(session, 'README.md'),
      expect({ response, check }) {
        check('status', 422, response.status);
        check(
          'error body',
          apiError(422, 'Unprocessable Entity', 'Path could not be read'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'missing, invalid or unknown worktree',
      request: (session) => [
        asset(session, 'missing.png'),
        asset(session, '../outside.png'),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/asset`,
          query: { path: 'logo.svg' },
        },
      ],
      expect({ responses, check }) {
        check('missing status', 404, responses[0]?.status);
        check(
          'missing error body',
          apiError(404, 'Not Found', 'Path not found'),
          responses[0]?.body,
        );
        check('invalid status', 400, responses[1]?.status);
        check('invalid error body', invalidRequest, responses[1]?.body);
        check('unknown worktree status', 404, responses[2]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[2]?.body,
        );
      },
    }),
  ],
});

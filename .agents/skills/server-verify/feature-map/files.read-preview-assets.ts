import { readPreviewAssetsResponseSchema } from '@porcelain/contracts/files';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  credentialLink,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';

export default defineFeature({
  feature: 'files.read-preview-assets',
  reaches: 'POST /api/worktrees/:worktreeId/preview-assets',
  paired: true,
  intent: 'observed',
  behaviour:
    'A Markdown preview asks for the images a document references, by paths relative to that document. Each is answered in request order as an asset (media type and base64) or as unavailable, including paths that are missing or escape the worktree, so one bad reference never fails the preview. A symbolic link that leaves the worktree is unavailable too.',
  cases: [
    defineCase({
      name: 'found, missing and escaping references',
      async setup(session) {
        await session.writeFile('logo.svg', svg);
      },
      request: (session) => ({
        method: 'POST',
        path: worktreePath(session, '/preview-assets'),
        body: {
          document: 'README.md',
          paths: ['logo.svg', 'missing.png', '../outside.png'],
        },
      }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readPreviewAssetsResponseSchema,
          response.body,
        );
        check(
          'body',
          {
            assets: [
              {
                kind: 'asset',
                path: 'logo.svg',
                mediaType: 'image/svg+xml',
                base64: Buffer.from(svg).toString('base64'),
              },
              { kind: 'unavailable', path: 'missing.png' },
              { kind: 'unavailable', path: '../outside.png' },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        {
          method: 'POST',
          path: worktreePath(session, '/preview-assets'),
          body: { document: 'README.md', paths: [] },
        },
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/preview-assets`,
          body: { document: 'README.md', paths: ['logo.svg'] },
        },
      ],
      expect({ responses, check }) {
        check('invalid status', 400, responses[0]?.status);
        check('invalid error body', invalidRequest, responses[0]?.body);
        check('unknown worktree status', 404, responses[1]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'a symbolic link out of the worktree',
      setup: (session) => session.symlink(credentialLink, 'escape.svg'),
      request: (session) => ({
        method: 'POST',
        path: worktreePath(session, '/preview-assets'),
        body: { document: 'README.md', paths: ['escape.svg', 'logo.svg'] },
      }),
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'the link is unavailable and the image beside it is not',
          {
            assets: [
              { kind: 'unavailable', path: 'escape.svg' },
              {
                kind: 'asset',
                path: 'logo.svg',
                mediaType: 'image/svg+xml',
                base64: Buffer.from(svg).toString('base64'),
              },
            ],
          },
          response.body,
        );
      },
    }),
  ],
});

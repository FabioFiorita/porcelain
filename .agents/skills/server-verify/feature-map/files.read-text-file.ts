import { readTextFileResponseSchema } from '../../../../packages/contracts/src/files/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  sampleChange,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const text = (session: Session, path: string) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/text'),
  query: { path },
});

export default defineFeature({
  feature: 'files.read-text-file',
  reaches: 'GET /api/worktrees/:worktreeId/text',
  intent: 'observed',
  behaviour:
    'A reviewer reads a UTF-8 text file from the worktree as it is on disk, with its byte length and a content fingerprint that a later edit must present. Binary or non-UTF-8 files are refused as unsupported text; paths that escape the worktree, absolute paths and the root are invalid; a missing file is not found.',
  cases: [
    defineCase({
      name: 'the changed README',
      request: (session) => text(session, 'README.md'),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readTextFileResponseSchema, response.body);
        check(
          'body',
          {
            worktreeId: session.worktreeId,
            path: 'README.md',
            encoding: 'utf-8',
            byteLength: 41,
            text: sampleChange,
            contentFingerprint:
              '5805fc9b5cf5a14cea6b2274b2ef5afac4bf9261823de0a3e94ead6c915f6baf',
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a file that is not UTF-8 text',
      setup: (session) =>
        session.writeFile(
          'image.bin',
          new Uint8Array([0xff, 0xfe, 0x00, 0x01]),
        ),
      request: (session) => text(session, 'image.bin'),
      expect({ response, check }) {
        check('status', 422, response.status);
        check(
          'error body',
          apiError(
            422,
            'Unprocessable Entity',
            'File is not supported UTF-8 text',
          ),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'missing file',
      request: (session) => text(session, 'missing.md'),
      expect({ response, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Path not found'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        text(session, '../credential.json'),
        text(session, '/etc/passwd'),
        text(session, ''),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/text`,
          query: { path: 'README.md' },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 3).entries()) {
          check(`invalid request ${index + 1} status`, 400, response.status);
          check(
            `invalid request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check('unknown worktree status', 404, responses[3]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[3]?.body,
        );
      },
    }),
  ],
});

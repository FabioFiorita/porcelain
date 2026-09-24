import { readTextFileResponseSchema } from '@porcelain/contracts/files';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  credentialLink,
  read,
  unreadablePath,
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
  paired: true,
  intent: 'observed',
  behaviour:
    'A reviewer reads a UTF-8 text file from the worktree as it is on disk, with its byte length and a content fingerprint that a later edit must present; the fingerprint stays while the content does and moves when it changes. Binary or non-UTF-8 files are refused as unsupported text; paths that escape the worktree, absolute paths and the root are invalid; a missing file is not found. A symbolic link is never followed, even to a file inside the worktree: it cannot be read (422).',
  cases: [
    defineCase({
      name: 'the changed README',
      setup: (session) =>
        read(session, text(session, session.fixture.readme.path)),
      request: (session) => [
        text(session, session.fixture.readme.path),
        text(session, session.fixture.readme.path),
      ],
      async expect({
        responses,
        state,
        session,
        check,
        checkContract,
        checkDiffers,
      }) {
        const [first, second] = responses;
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract('contract', readTextFileResponseSchema, first?.body);
        check(
          'body',
          {
            worktreeId: session.worktreeId,
            path: session.fixture.readme.path,
            encoding: 'utf-8',
            byteLength: Buffer.byteLength(session.fixture.readme.changed),
            text: session.fixture.readme.changed,
            contentFingerprint: state.contentFingerprint,
          },
          first?.body,
        );
        check('a second read answers the same', first?.body, second?.body);
        await session.writeFile(session.fixture.readme.path, 'Edited\n');
        const edited = await read(
          session,
          text(session, session.fixture.readme.path),
        );
        checkDiffers(
          'the fingerprint moves with the content',
          state.contentFingerprint,
          edited.contentFingerprint,
        );
        await session.writeFile(
          session.fixture.readme.path,
          session.fixture.readme.changed,
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
    defineCase({
      name: 'a symbolic link, whether it leaves the worktree or not',
      async setup(session) {
        await session.symlink(credentialLink, 'escape.txt');
        await session.symlink(session.fixture.readme.path, 'inside.md');
      },
      request: (session) => [
        text(session, 'escape.txt'),
        text(session, 'inside.md'),
      ],
      expect({ responses, check }) {
        check('escaping link status', 422, responses[0]?.status);
        check('escaping link error body', unreadablePath, responses[0]?.body);
        check('inside link status', 422, responses[1]?.status);
        check('inside link error body', unreadablePath, responses[1]?.body);
      },
    }),
  ],
});

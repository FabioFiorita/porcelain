import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { editFileResponseSchema } from '../../../../packages/contracts/src/files/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { read, worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const edit = (session: Session, body: unknown) => ({
  method: 'POST' as const,
  path: worktreePath(session, '/files'),
  body,
});
const readmeFingerprint =
  '5805fc9b5cf5a14cea6b2274b2ef5afac4bf9261823de0a3e94ead6c915f6baf';
const exists = (session: Session, path: string) =>
  existsSync(join(session.repository, path));

export default defineFeature({
  feature: 'files.edit-file',
  reaches: 'POST /api/worktrees/:worktreeId/files',
  intent: 'intended',
  behaviour:
    "The owner edits a worktree in place instead of opening an editor: writes a text file only if its content still matches the fingerprint they read, creates a file or folder, moves an entry, or moves it to the machine's trash. Each answers with the resulting path (and the new fingerprint after a write). Writing over changed content, or creating over an existing entry, is a conflict; paths inside .git and paths that escape the worktree are invalid input.",
  cases: [
    defineCase({
      name: 'write with the current fingerprint',
      request: (session) =>
        edit(session, {
          kind: 'write',
          path: 'README.md',
          text: 'Rewritten\n',
          expectedFingerprint: readmeFingerprint,
        }),
      async expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', editFileResponseSchema, response.body);
        const reread = await read(session, {
          method: 'GET',
          path: worktreePath(session, '/text'),
          query: { path: 'README.md' },
        });
        check(
          'body',
          { path: 'README.md', contentFingerprint: reread.contentFingerprint },
          response.body,
        );
        check(
          'file on disk',
          'Rewritten\n',
          await session.readFile('README.md'),
        );
      },
    }),
    defineCase({
      name: 'write over changed content',
      request: (session) =>
        edit(session, {
          kind: 'write',
          path: 'README.md',
          text: 'Lost\n',
          expectedFingerprint: readmeFingerprint,
        }),
      async expect({ response, session, check }) {
        check('status', 409, response.status);
        check(
          'error body',
          apiError(409, 'Conflict', 'Content changed; retry the operation'),
          response.body,
        );
        check(
          'file unchanged',
          'Rewritten\n',
          await session.readFile('README.md'),
        );
      },
    }),
    defineCase({
      name: 'create a folder and a file, then move the file',
      request: (session) => [
        edit(session, { kind: 'create', path: 'docs', entryKind: 'directory' }),
        edit(session, { kind: 'create', path: 'draft.md', entryKind: 'file' }),
        edit(session, {
          kind: 'move',
          path: 'draft.md',
          destination: 'docs/final.md',
        }),
      ],
      async expect({ responses, session, check }) {
        check(
          'bodies',
          [{ path: 'docs' }, { path: 'draft.md' }, { path: 'docs/final.md' }],
          responses.map((entry) => entry.body),
        );
        check(
          'moved file is empty',
          '',
          await session.readFile('docs/final.md'),
        );
        check('source is gone', false, exists(session, 'draft.md'));
      },
    }),
    defineCase({
      name: 'create over an existing entry',
      request: (session) =>
        edit(session, { kind: 'create', path: 'README.md', entryKind: 'file' }),
      async expect({ response, session, check }) {
        check('status', 409, response.status);
        check(
          'error body',
          apiError(409, 'Conflict', 'An entry already exists at that path'),
          response.body,
        );
        check(
          'file unchanged',
          'Rewritten\n',
          await session.readFile('README.md'),
        );
      },
    }),
    defineCase({
      name: 'move to trash',
      request: (session) =>
        edit(session, { kind: 'trash', path: 'docs/final.md' }),
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check('body', { path: 'docs/final.md' }, response.body);
        check('file is gone', false, exists(session, 'docs/final.md'));
      },
    }),
    defineCase({
      name: 'move a missing entry',
      request: (session) =>
        edit(session, {
          kind: 'move',
          path: 'missing.md',
          destination: 'docs/missing.md',
        }),
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
      name: 'inside .git',
      request: (session) =>
        edit(session, {
          kind: 'create',
          path: '.git/hooks/pre-commit',
          entryKind: 'file',
        }),
      expect({ response, session, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
        check(
          'nothing created',
          false,
          exists(session, '.git/hooks/pre-commit'),
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        edit(session, {
          kind: 'create',
          path: '../outside',
          entryKind: 'file',
        }),
        edit(session, { kind: 'explode', path: 'README.md' }),
        edit(session, { kind: 'write', path: 'README.md', text: 'x' }),
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/files`,
          body: {
            kind: 'write',
            path: 'README.md',
            text: 'x',
            expectedFingerprint: unknownFingerprint,
          },
        },
      ],
      async expect({ responses, session, check }) {
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
        check(
          'nothing escaped',
          false,
          existsSync(join(session.projectHome, 'outside')),
        );
        check(
          'README untouched',
          'Rewritten\n',
          await session.readFile('README.md'),
        );
      },
    }),
  ],
});

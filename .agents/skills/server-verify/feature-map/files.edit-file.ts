import { editFileResponseSchema } from '@porcelain/contracts/files';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  text,
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
async function contentFingerprint(session: Session, path: string) {
  const file = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path },
  });
  return text(file.contentFingerprint);
}

export default defineFeature({
  feature: 'files.edit-file',
  reaches: 'POST /api/worktrees/:worktreeId/files',
  paired: true,
  intent: 'intended',
  behaviour:
    "The owner edits a worktree in place instead of opening an editor: writes a text file only if its content still matches the fingerprint they read, creates a file or folder, moves an entry, or moves it to the machine's trash. Each answers with the resulting path (and the new fingerprint after a write). Writing over changed content, or creating over an existing entry, is a conflict; paths inside .git and paths that escape the worktree are invalid input.",
  cases: [
    defineCase({
      name: 'write with the current fingerprint',
      setup: (session) =>
        contentFingerprint(session, session.fixture.readme.path),
      request: (session, fingerprint) =>
        edit(session, {
          kind: 'write',
          path: session.fixture.readme.path,
          text: 'Rewritten\n',
          expectedFingerprint: fingerprint,
        }),
      async expect({
        response,
        state,
        session,
        check,
        checkContract,
        checkDiffers,
      }) {
        check('status', 200, response.status);
        checkContract('contract', editFileResponseSchema, response.body);
        const written = await contentFingerprint(
          session,
          session.fixture.readme.path,
        );
        check(
          'body',
          { path: session.fixture.readme.path, contentFingerprint: written },
          response.body,
        );
        checkDiffers('the fingerprint moved', state, written);
        check(
          'file on disk',
          'Rewritten\n',
          await session.readFile(session.fixture.readme.path),
        );
      },
    }),
    defineCase({
      name: 'write over changed content',
      async setup(session) {
        const seen = await contentFingerprint(
          session,
          session.fixture.readme.path,
        );
        await session.writeFile(
          session.fixture.readme.path,
          'Changed elsewhere\n',
        );
        return seen;
      },
      request: (session, fingerprint) =>
        edit(session, {
          kind: 'write',
          path: session.fixture.readme.path,
          text: 'Lost\n',
          expectedFingerprint: fingerprint,
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
          'Changed elsewhere\n',
          await session.readFile(session.fixture.readme.path),
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
          'statuses',
          [200, 200, 200],
          responses.map((entry) => entry.status),
        );
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
        check(
          'the source left the root',
          ['.git', session.fixture.readme.path, 'docs'],
          await session.entries(''),
        );
        check(
          'the folder holds the moved file',
          ['final.md'],
          await session.entries('docs'),
        );
      },
    }),
    defineCase({
      name: 'create over an existing entry',
      request: (session) =>
        edit(session, {
          kind: 'create',
          path: session.fixture.readme.path,
          entryKind: 'file',
        }),
      async expect({ response, session, check }) {
        check('status', 409, response.status);
        check(
          'error body',
          apiError(409, 'Conflict', 'An entry already exists at that path'),
          response.body,
        );
        check(
          'file unchanged',
          'Changed elsewhere\n',
          await session.readFile(session.fixture.readme.path),
        );
      },
    }),
    defineCase({
      name: 'move to trash',
      request: (session) =>
        edit(session, { kind: 'trash', path: 'docs/final.md' }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check('body', { path: 'docs/final.md' }, response.body);
        check('file is gone', [], await session.entries('docs'));
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
      setup: (session) => session.entries('.git'),
      request: (session) =>
        edit(session, {
          kind: 'create',
          path: '.git/hooks/pre-commit',
          entryKind: 'file',
        }),
      async expect({ response, state, session, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
        check('nothing created', state, await session.entries('.git'));
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      setup: (session) => session.entries('..'),
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
      async expect({ responses, state, session, check }) {
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
        check('nothing escaped', state, await session.entries('..'));
        check(
          'README untouched',
          'Changed elsewhere\n',
          await session.readFile(session.fixture.readme.path),
        );
      },
    }),
  ],
});

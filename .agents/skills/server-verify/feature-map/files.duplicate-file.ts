import { editFileResponseSchema } from '@porcelain/contracts/files';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  type Session,
} from '../scripts/feature.ts';
import {
  credentialLink,
  read,
  unreadablePath,
  worktreePath,
} from '../scripts/fixture.ts';

const copy = (session: Session, path: string, destination: string) => ({
  method: 'POST' as const,
  path: worktreePath(session, '/files'),
  body: { kind: 'copy', path, destination },
});

export default defineFeature({
  feature: 'files.duplicate-file',
  reaches: 'POST /api/worktrees/:worktreeId/files',
  paired: true,
  intent: 'intended',
  behaviour:
    'The owner duplicates a file of the worktree under a new name: the copy holds the same bytes and the original stays as it was, and the answer is the path of the copy. Copying onto an existing entry is a conflict and changes neither; a missing source is not found; a folder, or a symbolic link, cannot be duplicated (422), and neither can a copy be written through a link that leaves the worktree; paths inside .git or outside the worktree are invalid input.',
  cases: [
    defineCase({
      name: 'duplicate a changed file',
      request: (session) =>
        copy(session, session.fixture.readme.path, 'README copy.md'),
      async expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        check('body', { path: 'README copy.md' }, response.body);
        checkContract('contract', editFileResponseSchema, response.body);
        check(
          'the copy holds the changed text',
          session.fixture.readme.changed,
          await session.readFile('README copy.md'),
        );
        check(
          'the original is unchanged',
          session.fixture.readme.changed,
          await session.readFile(session.fixture.readme.path),
        );
        check(
          'both are in the worktree',
          ['.git', 'README copy.md', session.fixture.readme.path],
          await session.entries(''),
        );
      },
    }),
    defineCase({
      name: 'onto an existing entry or from a missing source',
      async setup(session) {
        await session.writeFile('README copy.md', 'Kept\n');
      },
      request: (session) => [
        copy(session, session.fixture.readme.path, 'README copy.md'),
        copy(session, 'missing.md', 'missing copy.md'),
      ],
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [409, 404],
          responses.map((entry) => entry.status),
        );
        check(
          'conflict body',
          apiError(409, 'Conflict', 'An entry already exists at that path'),
          responses[0]?.body,
        );
        check(
          'not found body',
          apiError(404, 'Not Found', 'Path not found'),
          responses[1]?.body,
        );
        check(
          'the existing entry is kept',
          'Kept\n',
          await session.readFile('README copy.md'),
        );
      },
    }),
    defineCase({
      name: 'a folder, a symbolic link or a copy through a link out of the worktree',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/files'),
          body: { kind: 'create', path: 'docs', entryKind: 'directory' },
        });
        await session.symlink('..', 'up');
        await session.symlink(credentialLink, 'secret.txt');
        return session.entries('..');
      },
      request: (session) => [
        copy(session, 'docs', 'docs copy'),
        copy(session, 'secret.txt', 'secret copy.txt'),
        copy(session, session.fixture.readme.path, 'up/planted.md'),
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 422, response.status);
          check(
            `request ${index + 1} error body`,
            unreadablePath,
            response.body,
          );
        }
        check(
          'nothing reached the project home',
          state,
          await session.entries('..'),
        );
        check(
          'no copy was made',
          [
            '.git',
            'README copy.md',
            session.fixture.readme.path,
            'docs',
            'secret.txt',
            'up',
          ],
          await session.entries(''),
        );
      },
    }),
    defineCase({
      name: 'invalid paths',
      request: (session) => [
        copy(session, session.fixture.readme.path, '.git/README.md'),
        copy(session, session.fixture.readme.path, '../outside.md'),
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

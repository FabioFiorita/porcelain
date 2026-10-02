import { apiError, defineCase, defineFeature } from '../scripts/feature.ts';
import { type Session } from '../../../../apps/server/spec/kit/session.ts';
import { worktreePath } from '../scripts/fixture.ts';

const mebibyte = 1024 * 1024;
const copy = (session: Session, path: string, destination: string) => ({
  method: 'POST' as const,
  path: worktreePath(session, '/files'),
  body: { kind: 'copy', path, destination },
});

export default defineFeature({
  feature: 'files.duplicate-file-limit',
  reaches: 'POST /api/worktrees/:worktreeId/files',
  paired: true,
  intent: 'intended',
  behaviour:
    'Duplicating copies files up to ten mebibytes, the largest file the owner can read as an asset; a larger file is refused as too large and no copy is left behind.',
  cases: [
    defineCase({
      name: 'a file at the limit and one past it',
      async setup(session) {
        await session.writeFile('limit.bin', 'x'.repeat(10 * mebibyte));
        await session.writeFile('past.bin', 'x'.repeat(10 * mebibyte + 1));
      },
      request: (session) => [
        copy(session, 'limit.bin', 'limit copy.bin'),
        copy(session, 'past.bin', 'past copy.bin'),
      ],
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [200, 422],
          responses.map((entry) => entry.status),
        );
        check('copied', { path: 'limit copy.bin' }, responses[0]?.body);
        check(
          'too large',
          apiError(
            422,
            'Unprocessable Entity',
            'File exceeds the read limit',
            'file_too_large',
          ),
          responses[1]?.body,
        );
        check(
          'no copy of the large file',
          ['.git', 'README.md', 'limit copy.bin', 'limit.bin', 'past.bin'],
          await session.entries(''),
        );
      },
    }),
  ],
});

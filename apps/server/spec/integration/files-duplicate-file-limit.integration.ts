import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const MEBIBYTE = 1024 * 1024;
const copy = (
  session: Session,
  path: string,
  destination: string,
): HttpRequest => ({
  method: 'POST',
  path: worktreePath(session, '/files'),
  body: { kind: 'copy', path, destination },
});

test('duplicating copies a file of ten mebibytes and refuses a larger one as too large without leaving a copy', async ({
  session,
}) => {
  await session.writeFile('limit.bin', 'x'.repeat(10 * MEBIBYTE));
  await session.writeFile('past.bin', 'x'.repeat(10 * MEBIBYTE + 1));

  const limit = await session.send(
    copy(session, 'limit.bin', 'limit copy.bin'),
  );
  const past = await session.send(copy(session, 'past.bin', 'past copy.bin'));

  expect([limit.status, past.status]).toStrictEqual([200, 422]);
  expect(limit.body).toStrictEqual({ path: 'limit copy.bin' });
  expect(past.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      'File exceeds the read limit',
      'file_too_large',
    ),
  );
  expect(await session.entries('')).toStrictEqual([
    '.git',
    'README.md',
    'limit copy.bin',
    'limit.bin',
    'past.bin',
  ]);
});

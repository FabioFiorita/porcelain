import { expect } from 'vitest';
import { Schema } from 'effect';
import { readWalkthroughResponseSchema } from '@porcelain/contracts/walkthroughs';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { text } from '../kit/session.ts';

test('reads the latest attempt and reports when its pinned head is out of date', async ({
  session,
}) => {
  await session.git('branch', 'walkthrough-base');
  await session.writeFile('walkthrough.txt', 'A small committed change.\n');
  await session.git('add', 'walkthrough.txt');
  await session.git('commit', '-m', 'Add walkthrough fixture');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const first = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-base' },
  });
  const initial = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(initial.outOfDate).toBe(false);
  expect(initial.walkthrough?.headOid).toBe(text(first.headOid));
  await session.writeFile('walkthrough.txt', 'The next committed change.\n');
  await session.git('add', 'walkthrough.txt');
  await session.git('commit', '-m', 'Advance the walkthrough head');
  const stale = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(stale.outOfDate).toBe(true);
  expect(stale.walkthrough?.id).toBe(text(first.id));
  expect(stale.walkthrough?.headOid).toBe(text(first.headOid));
  const updated = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-base' },
  });
  expect(text(updated.id)).not.toBe(text(first.id));
  await session.git('reset', '--hard', text(first.headOid));
  const returned = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(returned.outOfDate).toBe(true);
  expect(returned.walkthrough?.id).toBe(text(updated.id));
});

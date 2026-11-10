import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { inventory } from '../kit/reads.ts';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { UNKNOWN_UUID } from '../kit/answers.ts';

test('validates project walkthrough settings and reads them back in inventory', async ({
  session,
}) => {
  const path = `/api/projects/${session.projectId}/walkthrough-settings`;
  const before = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await inventory(session),
  );
  expect(
    before.projects.find((project) => project.id === session.projectId)
      ?.walkthroughSettings,
  ).toEqual({ mode: 'manual', provider: 'claude' });
  expect(
    await read(session, {
      method: 'PUT',
      path,
      body: { mode: 'automatic', provider: 'codex' },
    }),
  ).toEqual({ mode: 'automatic', provider: 'codex' });
  expect(
    Schema.decodeUnknownSync(readInventoryResponseSchema)(
      await inventory(session),
    ).projects.find((project) => project.id === session.projectId)
      ?.walkthroughSettings,
  ).toEqual({ mode: 'automatic', provider: 'codex' });
  expect(
    await read(session, {
      method: 'PUT',
      path,
      body: { mode: 'manual', provider: 'claude' },
    }),
  ).toEqual({ mode: 'manual', provider: 'claude' });
  expect(
    (
      await session.send({
        method: 'PUT',
        path,
        body: { mode: 'sometimes', provider: 'claude' },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await session.send({
        method: 'PUT',
        path: `/api/projects/${UNKNOWN_UUID}/walkthrough-settings`,
        body: { mode: 'automatic', provider: 'claude' },
      })
    ).status,
  ).toBe(404);
});

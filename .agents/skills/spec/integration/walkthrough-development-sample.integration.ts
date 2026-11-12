import { resolve } from 'node:path';
import { expect, inject, test } from 'vitest';
import { Schema } from 'effect';
import { readWalkthroughResponseSchema } from '@porcelain/contracts/walkthroughs';
import {
  IsolatedServer,
  Recorder,
} from '@porcelain/server/kit/isolated-server';

const root = resolve(import.meta.dirname, '../../../..');

test('the development walkthrough sample serves a ready page for the committed feature branch', async ({
  onTestFinished,
}) => {
  const server = await IsolatedServer.start(
    root,
    inject('serverBuild'),
    'walkthrough',
  );
  onTestFinished(() => server.stop());
  const ids = await server.sampleIds();
  const response = await server.read(new Recorder(), {
    method: 'GET',
    path: `/api/worktrees/${ids.worktreeId}/walkthrough`,
  });
  expect(response.status).toBe(200);
  const view = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    response.body,
  );
  expect(view.freshness).toBe('current');
  expect(view.walkthrough?.branch).toBe('feature/note-search');
  const run = view.walkthrough;
  expect(run?.state.status).toBe('ready');
  if (run?.state.status !== 'ready') throw new Error('Expected a ready sample');
  expect(run.headOid).not.toBe(run.baseOid);
  expect(run.state.content.title).toBe('Find notes by title');
  expect(run.state.content.stops).toHaveLength(2);
  expect(run.state.content.stops.filter((stop) => stop.attention)).toHaveLength(
    1,
  );
  expect(run.state.content.growth.map((item) => item.what)).toEqual([
    'Title search',
    'Result label',
  ]);
  expect(run.state.content.onlyInTranscript).toHaveLength(1);
});

for (const sample of ['service-ahead', 'git-interruption'] as const) {
  test(`the ${sample} development sample still starts`, async ({
    onTestFinished,
  }) => {
    const server = await IsolatedServer.start(
      root,
      inject('serverBuild'),
      sample,
    );
    onTestFinished(() => server.stop());
    const health = await fetch(`${server.address}/api/health`);
    expect(health.status).toBe(200);
    expect((await server.sampleIds()).worktreeId).not.toBe('');
  });
}

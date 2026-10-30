import { expect } from 'vitest';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { toolCall, toolValue } from '@porcelain/server/kit/requests';
import { record, text } from '@porcelain/server/kit/session';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  commitReviewFixture,
  worktreePath,
} from '@porcelain/server/kit/requests';
import {
  readProjectReviews,
  readReviewMarks,
  readReview,
  readReviewPullRequest,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
  worktreeNavigatorState,
} from '@porcelain/client/projects';
import { connection } from '../kit/connection.ts';

test('a main checkout keeps its review progress and retained closed review stays readable when older reviews are shown', async ({
  server,
  session,
}) => {
  await commitReviewFixture(session);
  await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(
      session,
      0,
      '75dc6a36-a001-4d00-b511-c45430b99403',
      '75dc6a36-a001-4d00-b511-c45430b99404',
    ),
  });
  const {
    connected,
    registry,
    execute,
    read: nativeRead,
  } = await connection(server, session);
  const connections = [connected];
  const list = readWorktreeNavigator(connections);
  const entries = () =>
    registry.get(list).projects.flatMap((project) => project.entries);
  const stop = registry.mount(list);
  try {
    const records = await nativeRead(
      readProjectReviews({
        connection: connected,
        projectId: session.projectId,
      }),
    );
    const reviewId = records[0]?.reviewId;
    if (!reviewId) throw new Error('Missing published review');
    await expect
      .poll(
        () =>
          entries().find((entry) => entry.worktreeId === session.worktreeId)
            ?.review,
      )
      .toMatchObject({
        state: 'available',
        reviewId,
        closed: false,
        progress: { reviewed: 0, total: 1 },
      });
    expect(
      entries().filter((entry) => entry.worktreeId === session.worktreeId),
    ).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      kind: 'worktree',
      main: true,
      available: true,
    });
    const review = await nativeRead(
      readReview({ connection: connected, reviewId }),
    );
    const result = await nativeRead(
      readReviewMarks({ connection: connected, reviewId }),
    );
    expect(result.decisions).toEqual([]);
    const layer = review.revision?.content.layers[0];
    if (!layer) throw new Error('Publication omitted layers');
    const commands = reviewCommands({ connection: connected, reviewId });
    await execute(commands.mark, {
      kind: 'decision',
      revision: 1,
      layerId: layer.id,
      fingerprint: layer.fingerprint,
    });
    await execute(refreshWorktreeNavigator(connections), undefined);
    await expect
      .poll(
        () =>
          entries().find((entry) => entry.worktreeId === session.worktreeId)
            ?.review,
      )
      .toMatchObject({
        state: 'available',
        reviewId,
        progress: { reviewed: 1, total: 1 },
      });
    await execute(commands.close, undefined);
    await execute(refreshWorktreeNavigator(connections), undefined);
    await expect
      .poll(
        () =>
          entries().find((entry) => entry.worktreeId === session.worktreeId)
            ?.review,
      )
      .toEqual({ state: 'none' });
    expect(entries().some((entry) => entry.kind === 'review')).toBe(false);
    const state = registry.get(worktreeNavigatorState);
    registry.set(worktreeNavigatorState, {
      ...state,
      filter: { ...state.filter, older: true },
    });
    await expect
      .poll(() => entries().find((entry) => entry.kind === 'review')?.review)
      .toMatchObject({
        state: 'available',
        reviewId,
        closed: true,
        archived: false,
      });
    expect(entries().find((entry) => entry.kind === 'worktree')).toMatchObject({
      worktreeId: session.worktreeId,
      available: true,
    });
    const retained = await nativeRead(
      readReview({ connection: connected, reviewId }),
    );
    expect(retained.revision?.content.layers[0]?.id).toBe(
      '75dc6a36-a001-4d00-b511-c45430b99403',
    );
  } finally {
    stop();
  }
});

for (const main of [true, false])
  test(`linked merged reviews stay hidden by default, including main=${main}, and retain archived navigation`, async ({
    server,
    session,
  }) => {
    await commitReviewFixture(session);
    const branch = main ? 'main' : 'qa-closed';
    const checkout = main
      ? session.repository
      : join(session.projectHome, branch);
    if (!main) await session.git('worktree', 'add', '-b', branch, checkout);
    const remote = join(session.projectHome, `remote-${main}.git`);
    await mkdir(remote);
    execFileSync('git', ['init', '--bare', '-q', remote]);
    await session.git(
      'remote',
      main ? 'add' : 'set-url',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    await session.git('remote', 'set-url', '--push', 'origin', remote);
    execFileSync('git', ['-C', checkout, 'push', '-qu', 'origin', branch]);
    const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const manifest = record(
      JSON.parse(await readFile(server.manifestPath, 'utf8')),
    );
    const pr = {
      number: main ? 423 : 424,
      title: 'Closed review',
      url: `https://github.com/FabioFiorita/porcelain/pull/${main ? 423 : 424}`,
      state: 'MERGED',
      isDraft: false,
      author: { login: 'fixture' },
      headRefName: branch,
      updatedAt: '2026-10-21T03:00:00Z',
      commits: { nodes: [] },
      body: 'Finished',
      baseRefName: 'main',
      headRefOid: head,
      mergeable: 'UNKNOWN',
      labels: { nodes: [], pageInfo: { hasNextPage: false } },
      comments: { nodes: [], pageInfo: { hasNextPage: false } },
      reviews: { nodes: [], pageInfo: { hasNextPage: false } },
    };
    await writeFile(
      join(text(manifest.bin), 'gh'),
      `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args[0]==='auth'&&args[1]==='status') console.log('["fixture"]');\nelse if(args[0]==='auth') console.log('fixture-credential');\nelse if(args.includes('repos/FabioFiorita/porcelain')) console.log('{}');\nelse console.log(JSON.stringify({data:{repository:{pullRequest:${JSON.stringify(pr)}}}}));\n`,
      { mode: 0o755 },
    );
    const publish = toolCall(session, 1, 'publish_review', {
      ...sampleReview(
        session,
        0,
        '75dc6a36-a001-4d00-b511-c45430b99403',
        '75dc6a36-a001-4d00-b511-c45430b99404',
      ),
      base: 'refs/heads/porcelain-fixture-base',
      pullRequest: pr.url,
    });
    publish.headers = { ...publish.headers, 'x-porcelain-cwd': checkout };
    const reviewId = text(
      record(toolValue(await read(session, publish))).reviewId,
    );
    const {
      connected,
      registry,
      execute,
      read: nativeRead,
    } = await connection(server, session);
    const connections = [connected];
    const list = readWorktreeNavigator(connections);
    const entries = () =>
      registry.get(list).projects.flatMap((project) => project.entries);
    const stop = registry.mount(list);
    try {
      expect(
        await nativeRead(
          readReviewPullRequest({ connection: connected, reviewId }),
        ),
      ).toMatchObject({ kind: 'available', pullRequest: { state: 'merged' } });
      await execute(refreshWorktreeNavigator(connections), undefined);
      await expect
        .poll(() =>
          entries().some(
            (row) =>
              row.review.state === 'available' &&
              row.review.reviewId === reviewId,
          ),
        )
        .toBe(false);
      const state = registry.get(worktreeNavigatorState);
      registry.set(worktreeNavigatorState, {
        ...state,
        filter: { ...state.filter, older: true },
      });
      await expect
        .poll(() => entries().find((row) => row.kind === 'review')?.review)
        .toMatchObject({
          state: 'available',
          reviewId,
          closed: true,
          archived: false,
        });
      const commands = reviewCommands({ connection: connected, reviewId });
      const options = {
        deleteWorktree: main,
        deleteLocalBranch: true,
        deleteRemoteBranch: true,
      };
      if (!main)
        execFileSync('git', [
          '-C',
          checkout,
          'push',
          'origin',
          '--delete',
          branch,
        ]);
      const preview = await execute(commands.archive, { options });
      if (!main)
        expect(preview.plan).toMatchObject({
          unpushed: false,
          remoteBranchNote: 'origin/qa-closed: already deleted on remote.',
        });
      expect(preview.plan.remoteBranch).toBeUndefined();
      await execute(commands.archive, {
        options,
        confirmation: { plan: preview.plan, discardChanges: false },
      });
      await execute(refreshWorktreeNavigator(connections), undefined);
      await expect
        .poll(() => entries().find((row) => row.kind === 'review')?.review)
        .toMatchObject({
          state: 'available',
          reviewId,
          closed: true,
          archived: true,
        });
      const retained = await nativeRead(
        readReview({ connection: connected, reviewId }),
      );
      expect(retained.revision?.content.layers[0]?.id).toBe(
        '75dc6a36-a001-4d00-b511-c45430b99403',
      );
      if (!main) {
        expect(
          execFileSync(
            'git',
            ['-C', checkout, 'rev-parse', '--abbrev-ref', 'HEAD'],
            { encoding: 'utf8' },
          ).trim(),
        ).toBe('HEAD');
        await expect
          .poll(() =>
            entries()
              .filter((row) => row.kind === 'worktree')
              .map((row) => ({
                path: row.path,
                detached: row.detached,
                review: row.review.state,
              })),
          )
          .toContainEqual({ path: checkout, detached: true, review: 'none' });
      }
    } finally {
      stop();
    }
  });

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
  readReviewList,
  readProjectReviews,
  readReviewMarks,
  readReview,
  reviewCommands,
} from '@porcelain/client/reviews';
import { refreshInventory } from '@porcelain/client/projects';
import { connection } from '../kit/connection.ts';

test('a main checkout stays in Projects when reviewed and its retained closed review remains readable', async ({
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
  const list = readReviewList([connected]);
  const stop = registry.mount(list);
  try {
    await expect.poll(() => registry.get(list).loading).toBe(false);
    const row = registry
      .get(list)
      .entries.find((entry) => entry.group === 'Projects');
    expect(row).toMatchObject({
      group: 'Projects',
      reviewed: 0,
      total: 0,
      closed: false,
      worktreeId: session.worktreeId,
    });
    expect(row?.reviewId).toBeUndefined();
    const records = await nativeRead(
      readProjectReviews({
        connection: connected,
        projectId: session.projectId,
      }),
    );
    const reviewId = records[0]?.reviewId;
    if (!reviewId) throw new Error('Missing published review');
    expect(
      registry
        .get(list)
        .entries.filter((entry) => entry.worktreeId === session.worktreeId),
    ).toHaveLength(1);
    const review = await nativeRead(
      readReview({ connection: connected, reviewId }),
    );
    const result = await nativeRead(
      readReviewMarks({ connection: connected, reviewId }),
    );
    expect(result.decisions).toEqual([]);
    const layer = review.revision?.content.layers[0];
    if (!layer) throw new Error('Publication omitted layers');
    const commands = reviewCommands({
      connection: connected,
      reviewId,
    });
    await execute(commands.mark, {
      kind: 'decision',
      revision: 1,
      layerId: layer.id,
      fingerprint: layer.fingerprint,
    });
    await execute(refreshInventory(connected), undefined);
    await expect
      .poll(
        () =>
          registry
            .get(list)
            .entries.find((entry) => entry.worktreeId === session.worktreeId)
            ?.group,
      )
      .toBe('Projects');
    expect(
      registry
        .get(list)
        .entries.filter(
          (entry) => !entry.closed && entry.worktreeId === session.worktreeId,
        ),
    ).toHaveLength(1);
    await execute(commands.close, undefined);
    await execute(refreshInventory(connected), undefined);
    await expect
      .poll(
        () =>
          registry
            .get(list)
            .entries.find((entry) => entry.reviewId === reviewId)?.closed,
      )
      .toBe(true);
    expect(
      registry.get(list).entries.find((entry) => entry.group === 'Projects'),
    ).toMatchObject({ worktreeId: session.worktreeId, disabled: false });
    expect(review).toHaveProperty('review');
  } finally {
    stop();
  }
});

for (const main of [true, false])
  test(`linked merged reviews stay only in Closed, including main=${main}, and retain archived navigation`, async ({
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
    const { connected, registry, execute } = await connection(server, session);
    const list = readReviewList([connected]);
    const stop = registry.mount(list);
    try {
      await expect
        .poll(
          () =>
            registry.get(list).entries.find((row) => row.reviewId === reviewId)
              ?.closed,
        )
        .toBe(true);
      expect(
        registry.get(list).entries.find((row) => row.reviewId === reviewId),
      ).toMatchObject({
        group: 'Closed',
        closed: true,
        archivable: true,
        archived: false,
      });
      expect(
        registry
          .get(list)
          .entries.filter((row) => !row.closed)
          .every(
            (row) => row.group === 'Projects' || row.group === 'No review',
          ),
      ).toBe(true);
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
      await execute(refreshInventory(connected), undefined);
      await expect
        .poll(
          () =>
            registry.get(list).entries.find((row) => row.reviewId === reviewId)
              ?.archived,
        )
        .toBe(true);
      expect(
        registry.get(list).entries.find((row) => row.reviewId === reviewId),
      ).toMatchObject({
        group: 'Closed',
        closed: true,
        archivable: false,
        archived: true,
      });
      if (!main) {
        await expect
          .poll(() =>
            registry
              .get(list)
              .entries.some(
                (row) =>
                  row.group === 'No review' &&
                  row.title === branch &&
                  row.path === checkout &&
                  row.detached,
              ),
          )
          .toBe(true);
        expect(
          execFileSync(
            'git',
            ['-C', checkout, 'rev-parse', '--abbrev-ref', 'HEAD'],
            { encoding: 'utf8' },
          ).trim(),
        ).toBe('HEAD');
      }
    } finally {
      stop();
    }
  });

import { expect, test } from './fixtures.tsx';

const title = 'Retain the original discussion';

test('threads from other heads stay at file level with a route to their original revision in both directions', async ({
  repo,
  agent,
  render,
}) => {
  const first = await repo.review(title);
  await agent.comment('review-page.ts', 'Discuss the first revision', {
    reviewId: first.reviewId,
    reviewRevision: first.revision,
    anchor: {
      kind: 'codeRange',
      filePath: 'review-page.ts',
      startLine: 1,
      endLine: 1,
      side: 'additions',
      revision: first.headOid,
      comparison: { kind: 'branch', base: 'refs/heads/review-page-base' },
    },
  });
  const second = await repo.review(title);
  await agent.comment('review-page.ts', 'Discuss the second revision', {
    reviewId: second.reviewId,
    reviewRevision: second.revision,
    anchor: {
      kind: 'codeRange',
      filePath: 'review-page.ts',
      startLine: 1,
      endLine: 1,
      side: 'additions',
      revision: second.headOid,
      comparison: { kind: 'branch', base: 'refs/heads/review-page-base' },
    },
  });
  const app = await render.route(
    `/reviews/${first.reviewId}/2/decisions/${first.layerId}`,
  );
  await expect
    .element(app.page.getByText('Discuss the first revision', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('Code changed since this comment', { exact: true }),
    )
    .toBeVisible();
  await app.page.getByRole('link', { name: 'Open r1', exact: true }).click();
  await app.page
    .getByRole('button', { name: 'Continue at decision 1', exact: true })
    .click();
  await expect
    .element(app.page.getByText('export const revision = 1;', { exact: true }))
    .toBeVisible();
  await expect
    .element(app.page.getByText('Discuss the second revision', { exact: true }))
    .toBeVisible();
  await expect
    .element(app.page.getByRole('link', { name: 'Open r2', exact: true }))
    .toBeVisible();
});

test('an unchanged context file accepts a whole-file comment and keeps its revision while the review advances', async ({
  agent,
  render,
  server,
  repo,
}) => {
  await agent.publishArchitecture();
  const first = (await server.publishedReview()).review;
  if (!first?.reviewId)
    throw new Error('The fixture must publish a retained review');
  const app = await render.route(`/reviews/${first.reviewId}`);
  await app.page
    .getByRole('button', {
      name: '2. Revoke access across devices',
      exact: true,
    })
    .click();
  const context = app.page.getByRole('region', {
    name: 'Existing code it relies on',
    exact: true,
  });
  await context
    .getByRole('button', {
      name: /^Comment on packages\/workspace\/src\/actor\.ts/,
    })
    .click();
  await context
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Keep the existing actor contract.');
  await context.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() => server.reviewComments(first.reviewId ?? ''))
    .toMatchObject([
      {
        review: { reviewId: first.reviewId, revision: first.revision },
        anchor: {
          kind: 'file',
          filePath: 'packages/workspace/src/actor.ts',
          revision: first.headOid,
          comparison: { kind: 'branch', base: first.base },
        },
        messages: [{ body: 'Keep the existing actor contract.' }],
      },
    ]);
  await expect
    .element(
      context.getByText('Keep the existing actor contract.', { exact: true }),
    )
    .toBeVisible();
  await repo.write('README.md', 'A later revision\n');
  await agent.publishArchitecture();
  await expect
    .poll(() => server.reviewComments(first.reviewId ?? ''))
    .toMatchObject([{ review: { revision: 1 } }]);
});

test('a deleted-line thread stays at file level when its step opens the retained head file', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  const layer = published?.layers[8];
  const step = layer?.steps.find(
    (item) => item.pointer.path === 'packages/workspace/src/policy.ts',
  );
  if (
    !published?.reviewId ||
    !published.headOid ||
    !published.base ||
    !layer ||
    !step
  )
    throw new Error('The fixture must include the shared policy step');
  await agent.comment(
    'packages/workspace/src/policy.ts',
    'Discuss the removed policy line',
    {
      reviewId: published.reviewId,
      reviewRevision: published.revision,
      anchor: {
        kind: 'codeRange',
        filePath: 'packages/workspace/src/policy.ts',
        startLine: 4,
        endLine: 4,
        side: 'deletions',
        revision: published.headOid,
        comparison: { kind: 'branch', base: published.base },
      },
    },
  );
  const app = await render.route(
    `/reviews/${published.reviewId}/1/decisions/${layer.id}`,
  );
  await app.page
    .getByRole('button', {
      name: `Go to step ${layer.steps.indexOf(step) + 1}: ${step.title}`,
      exact: true,
    })
    .click();
  await expect
    .element(
      app.page.getByRole('button', { name: 'Back to decision', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('Discuss the removed policy line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('Code changed since this comment', { exact: true }),
    )
    .toBeVisible();
});

test.for([
  { size: 'short', body: 'Keep this draft while another discussion arrives.' },
  {
    size: 'long',
    body: 'Keep this draft while another discussion arrives. '.repeat(60),
  },
])(
  'a retained context draft survives incoming discussion and can still be posted ($size)',
  async ({ body }, { agent, render, server }) => {
    await agent.publishArchitecture();
    const published = (await server.publishedReview()).review;
    const layer = published?.layers[1];
    if (!published?.reviewId || !published.headOid || !published.base || !layer)
      throw new Error('The fixture must include a retained context decision');
    const app = await render.route(
      `/reviews/${published.reviewId}/1/decisions/${layer.id}`,
    );
    const context = app.page.getByRole('region', {
      name: 'Existing code it relies on',
      exact: true,
    });
    await context
      .getByRole('button', {
        name: /^Comment on packages\/workspace\/src\/actor\.ts/,
      })
      .click();
    const draft = context.getByRole('textbox', {
      name: 'Comment',
      exact: true,
    });
    await draft.fill(body);
    await agent.comment(
      'packages/workspace/src/actor.ts',
      'Another retained actor discussion',
      {
        reviewId: published.reviewId,
        reviewRevision: published.revision,
        anchor: {
          kind: 'file',
          filePath: 'packages/workspace/src/actor.ts',
          revision: published.headOid,
          comparison: { kind: 'branch', base: published.base },
        },
      },
    );
    await expect
      .element(
        context.getByText('Another retained actor discussion', { exact: true }),
      )
      .toBeVisible();
    await expect.element(draft).toHaveValue(body);
    await context.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect
      .element(context.getByText(body, { exact: true }))
      .toBeVisible();
    await expect
      .poll(async () =>
        JSON.stringify(await server.reviewComments(published.reviewId ?? '')),
      )
      .toContain(JSON.stringify(body));
  },
);

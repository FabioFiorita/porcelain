import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const question =
  'Outbox and journal are updated separately. Transaction ownership needs a decision.';

test('a decision connected to a question pins it beside the decision, and its answer quotes the question on the whole change', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', {
      name: /^6\. Retry delivery without duplicate messages · /u,
    })
    .click();
  const decision = app.page.getByRole('region', {
    name: '6. Retry delivery without duplicate messages',
    exact: true,
  });
  const details = decision.getByRole('complementary', {
    name: 'Decision details',
    exact: true,
  });
  await expect
    .element(
      details.getByText('Needs your decision · Delivery outbox', {
        exact: true,
      }),
    )
    .toBeVisible();
  await details
    .getByRole('button', { name: 'Answer this question', exact: true })
    .click();
  await details
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Keep one transaction in the outbox owner.');
  await details.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() => server.reviewComments(published.reviewId ?? ''))
    .toMatchObject([
      {
        anchor: { kind: 'change', revision: published.headOid },
        messages: [
          {
            body: `> ${question}\n\nKeep one transaction in the outbox owner.`,
          },
        ],
      },
    ]);
});

test('the closing page keeps Ready to merge behind every decision and the agent recommending Merge, and marks the files it can from the dock', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture({ reviewed: false });
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  await expect(server.reviewMarks(published.reviewId)).resolves.toEqual({
    files: [],
    decisions: [],
  });
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  const completion = app.page.getByRole('region', {
    name: 'Review completion',
    exact: true,
  });
  await expect
    .element(completion.getByRole('heading', { level: 3 }))
    .toHaveTextContent('2 of 9 decisions reviewed');
  await expect
    .element(
      completion.getByRole('region', {
        name: 'Ready to merge needs',
        exact: true,
      }),
    )
    .toHaveTextContent(
      'Ready to merge needsEvery decision reviewedThe agent recommends Merge · r1 says HoldStill needs you',
    );
  const dock = app.page.getByRole('navigation', {
    name: 'Walkthrough dock',
    exact: true,
  });
  await dock
    .getByRole('button', { name: 'Mark 2 files reviewed', exact: true })
    .click();
  await expect
    .element(
      dock.getByRole('button', { name: 'Every file reviewed', exact: true }),
    )
    .toBeDisabled();
  const closing = app.page.getByRole('region', {
    name: 'Not explained',
    exact: true,
  });
  await expect
    .element(
      closing.getByRole('button', {
        name: 'Unmark docs/architecture.md as unreviewed',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(
      closing.getByRole('button', {
        name: 'Unmark packages/workspace/src/legacy-write.ts as unreviewed',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => server.reviewMarks(published.reviewId ?? ''))
    .toMatchObject({
      files: [
        { path: 'docs/architecture.md' },
        { path: 'packages/workspace/src/legacy-write.ts' },
      ],
    });
});

test('the agent summary lists the decisions its page links to and opens one from the margin', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('tab', { name: 'Agent summary', exact: true })
    .click();
  await expect
    .element(app.page.getByText('Sandboxed', { exact: true }))
    .toBeVisible();
  const links = app.page.getByRole('region', {
    name: 'Links in this page',
    exact: true,
  });
  await links
    .getByRole('button', {
      name: 'Establish the shared mutation boundary',
      exact: true,
    })
    .click();
  await expect
    .element(
      app.page.getByRole('region', {
        name: '9. Establish the shared mutation boundary',
        exact: true,
      }),
    )
    .toBeVisible();
});

test.for([
  [1440, 'margin', 'hidden'],
  [1440, 'inline', 'docked'],
  [900, 'inline', 'hidden'],
] as const)(
  'threads on neighbouring lines of a decision each stay readable and reachable at %i px, placed in the %s with the panel %s',
  { timeout: 30_000 },
  async (
    [width, placement, panel],
    { agent, render, server, reviewLayout },
  ) => {
    await browserPage.viewport(width, 896);
    try {
      await agent.publishArchitecture();
      const published = (await server.publishedReview()).review;
      if (!published?.reviewId || !published.headOid || !published.base)
        throw new Error('The published fixture has no review');
      const seeded = [
        ...[2, 3, 4, 5, 6].map((line) => ({
          path: 'packages/workspace/src/outbox.ts',
          line,
        })),
        ...[10, 11, 12].map((line) => ({
          path: 'packages/workspace/src/sessions.ts',
          line,
        })),
      ].map((thread) => ({
        ...thread,
        body: `${thread.path.split('/').at(-1)} line ${thread.line} needs a second look.`,
      }));
      for (const thread of seeded)
        await agent.comment(thread.path, thread.body, {
          reviewId: published.reviewId,
          reviewRevision: published.revision,
          anchor: {
            kind: 'codeRange',
            filePath: thread.path,
            startLine: thread.line,
            endLine: thread.line,
            side: 'additions',
            revision: published.headOid,
            comparison: { kind: 'branch', base: published.base },
          },
        });
      const app = await render.route(`/reviews/${published.reviewId}`);
      if (width >= 1280 && panel === 'hidden')
        await app.page
          .getByRole('button', { name: 'Hide side panel', exact: true })
          .click();
      await app.page
        .getByRole('button', {
          name: '9. Establish the shared mutation boundary · Shared owners',
          exact: true,
        })
        .click();
      const decision = app.page.getByRole('region', {
        name: '9. Establish the shared mutation boundary',
        exact: true,
      });
      const threads = decision.getByRole('article', {
        name: 'Comment thread',
        exact: true,
      });
      for (const file of ['outbox', 'sessions']) {
        const header = decision.getByRole('button', {
          name: new RegExp(`^Comment on packages/workspace/src/${file}\\.ts`),
        });
        await expect.element(header).toBeInTheDocument();
        reviewLayout.bringIntoView(header);
        const stack = threads.filter({ hasText: `${file}.ts line` });
        for (const thread of seeded.filter((item) =>
          item.path.endsWith(`/${file}.ts`),
        ))
          await expect
            .element(stack.filter({ hasText: thread.body }))
            .toBeVisible();
        await expect
          .poll(() => reviewLayout.placement(stack, header))
          .toBe(placement);
        await expect.poll(() => reviewLayout.separate(stack)).toBe(true);
      }
      for (const thread of seeded)
        await expect
          .poll(() =>
            reviewLayout.reachable(
              threads
                .filter({ hasText: thread.body })
                .getByRole('button', { name: 'Reply', exact: true }),
            ),
          )
          .toBe(true);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([414, 360])(
  'the dock keeps its primary action whole at %i px',
  async (width, { agent, render, server, reviewLayout }) => {
    await browserPage.viewport(width, 896);
    try {
      await agent.publishArchitecture();
      const published = (await server.publishedReview()).review;
      if (!published?.reviewId)
        throw new Error('The published fixture has no review');
      const app = await render.route(`/reviews/${published.reviewId}`);
      await app.page
        .getByRole('button', { name: 'Not explained', exact: true })
        .click();
      const dock = app.page.getByRole('navigation', {
        name: 'Walkthrough dock',
        exact: true,
      });
      const action = dock.getByRole('button', {
        name: 'Mark 2 files reviewed',
        exact: true,
      });
      await expect.element(action).toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, action))
        .toEqual({ inside: true, fits: true });
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

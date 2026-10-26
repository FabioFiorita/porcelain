import { page as browserPage, userEvent } from 'vitest/browser';
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
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
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
  '13 threads on neighbouring and shared lines of a decision stay readable and reachable at %i px, placed in the %s with the panel %s',
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
        ...[2, 2, 3, 4, 5, 6, 7, 8, 9, 11].map((line) => ({
          path: 'packages/workspace/src/outbox.ts',
          line,
        })),
        ...[10, 11, 12].map((line) => ({
          path: 'packages/workspace/src/sessions.ts',
          line,
        })),
      ].map((thread, index) => ({
        ...thread,
        body: `${thread.path.split('/').at(-1)} line ${thread.line} needs a second look. Thread ${index + 1}.`,
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
      const first = threads.filter({
        hasText: 'outbox.ts line 2 needs a second look. Thread 1.',
      });
      const sameLine = threads.filter({
        hasText: 'outbox.ts line 2 needs a second look. Thread 2.',
      });
      const sameLineAnchor = sameLine.getByRole('button', {
        name: 'Show packages/workspace/src/outbox.ts:2 in the code',
        exact: true,
      });
      const displaced = threads.filter({ hasText: 'outbox.ts line 11 needs' });
      const anchor = displaced.getByRole('button', {
        name: 'Show packages/workspace/src/outbox.ts:11 in the code',
        exact: true,
      });
      if (placement === 'margin') {
        await expect
          .element(first.getByText('+2', { exact: true }))
          .toBeVisible();
        await expect
          .poll(() => reviewLayout.hasAnchor(sameLineAnchor))
          .toBe(true);
        await expect.poll(() => reviewLayout.hasAnchor(anchor)).toBe(true);
        await expect.element(anchor).toHaveTextContent('outbox.ts:11');
        await anchor.click();
        await expect
          .poll(() => reviewLayout.highlightedCode(decision))
          .toContain('export function attempt(id: string) {');
        await expect
          .poll(() => reviewLayout.highlightVisible(decision))
          .toBe(true);
        await app.page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
        await browserPage.viewport(900, 896);
        await expect.element(anchor).not.toBeInTheDocument();
        await expect
          .element(displaced.getByText('+11', { exact: true }))
          .toBeVisible();
        await browserPage.viewport(1440, 896);
        await expect
          .poll(() => reviewLayout.paneWidth(decision))
          .toBeGreaterThanOrEqual(1024);
        await expect.element(anchor).toBeVisible();
      } else {
        await expect.element(sameLineAnchor).not.toBeInTheDocument();
        await expect
          .element(sameLine.getByText('+2', { exact: true }))
          .toBeVisible();
        await expect.element(anchor).not.toBeInTheDocument();
        await expect
          .element(displaced.getByText('+11', { exact: true }))
          .toBeVisible();
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

test('long displaced locations fit open and resolved cards and reveal their code', async ({
  agent,
  render,
  repo,
  reviewLayout,
}) => {
  await browserPage.viewport(1440, 896);
  try {
    const path = `${'session-'.repeat(20)}recovery.ts`;
    const published = await repo.review('Long file locations', undefined, {
      path,
      lane: 'Client',
    });
    for (const body of ['First shared anchor', 'Second shared anchor'])
      await agent.comment(path, body, {
        reviewId: published.reviewId,
        reviewRevision: published.revision,
        anchor: {
          kind: 'codeRange',
          filePath: path,
          startLine: 2,
          endLine: 2,
          side: 'additions',
          revision: published.headOid,
          comparison: { kind: 'branch', base: 'refs/heads/review-page-base' },
        },
      });
    const app = await render.route(`/reviews/${published.reviewId}`);
    await app.page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await app.page
      .getByRole('button', {
        name: '1. Long file locations · Client',
        exact: true,
      })
      .click();
    const decision = app.page.getByRole('region', {
      name: '1. Long file locations',
      exact: true,
    });
    const card = decision
      .getByRole('article', { name: 'Comment thread', exact: true })
      .filter({ hasText: 'Second shared anchor' });
    const name = `Show ${path}:2 in the code`;
    const location = card.getByRole('button', { name, exact: true });
    await expect.element(location).toBeVisible();
    await expect
      .poll(() => reviewLayout.holds(card, location))
      .toEqual({ inside: true, fits: true });
    await expect.poll(() => reviewLayout.reachable(location)).toBe(true);
    await location.hover();
    await expect
      .element(app.page.getByRole('tooltip', { name, exact: true }))
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await location.click();
    await expect
      .poll(() => reviewLayout.highlightedCode(decision))
      .toContain('export const title = "Long file locations";');
    await expect.poll(() => reviewLayout.highlightVisible(decision)).toBe(true);
    await card.getByRole('button', { name: 'Resolve', exact: true }).click();
    const resolved = decision
      .getByRole('article', { name: 'Resolved comment thread', exact: true })
      .filter({ hasText: 'Second shared anchor' });
    const resolvedLocation = resolved.getByRole('button', {
      name,
      exact: true,
    });
    await expect.element(resolvedLocation).toBeVisible();
    await expect
      .poll(() => reviewLayout.holds(resolved, resolvedLocation))
      .toEqual({ inside: true, fits: true });
    reviewLayout.focus(resolvedLocation);
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => reviewLayout.highlightVisible(decision)).toBe(true);
  } finally {
    await browserPage.viewport(414, 896);
  }
});

test('resizing the tab strip preserves the review reading position', async ({
  agent,
  render,
  server,
  reviewLayout,
}) => {
  await browserPage.viewport(1440, 896);
  try {
    await agent.publishArchitecture();
    const published = (await server.publishedReview()).review;
    if (!published?.reviewId) throw new Error('The fixture has no review');
    const app = await render.route(`/reviews/${published.reviewId}`);
    await app.page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await app.page
      .getByRole('button', {
        name: '9. Establish the shared mutation boundary · Shared owners',
        exact: true,
      })
      .click();
    const review = app.page.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    const tab = review.getByRole('tab', { name: 'Review', exact: true });
    await expect
      .element(
        review.getByRole('button', {
          name: 'Comment on packages/workspace/src/sessions.ts (added)',
          exact: true,
        }),
      )
      .toBeInTheDocument();
    reviewLayout.scrollToEnd(review);
    await expect
      .poll(() => reviewLayout.scrollTop(review))
      .toBeGreaterThan(500);
    const before = reviewLayout.scrollTop(review);
    const resized = reviewLayout.tabStripResized(tab);
    await browserPage.viewport(1430, 896);
    await resized;
    await expect
      .poll(() => reviewLayout.scrollTop(review))
      .toBeGreaterThan(before - 1);
  } finally {
    await browserPage.viewport(414, 896);
  }
});

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
      const stop = dock.getByRole('button', {
        name: 'Not explained, jump to a stop',
        exact: true,
      });
      await expect
        .element(stop.getByText('11/11', { exact: true }))
        .toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, stop))
        .toEqual({ inside: true, fits: true });
      const action = dock.getByRole('button', {
        name: 'Mark 2 files reviewed',
        exact: true,
      });
      await expect.element(action).toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, action))
        .toEqual({ inside: true, fits: true });
      await stop.click();
      await app.page
        .getByRole('menuitem', {
          name: '9. Establish the shared mutation boundary',
          exact: true,
        })
        .click();
      const decisionStop = dock.getByRole('button', {
        name: 'Decision 9 of 9, jump to a stop',
        exact: true,
      });
      await expect
        .element(decisionStop.getByText('9/9', { exact: true }))
        .toBeVisible();
      await expect
        .poll(() =>
          reviewLayout.holds(
            dock,
            dock.getByRole('button', {
              name: 'Mark decision reviewed',
              exact: true,
            }),
          ),
        )
        .toEqual({ inside: true, fits: true });
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

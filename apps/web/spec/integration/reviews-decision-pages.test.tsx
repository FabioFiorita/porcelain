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
      name: '6. Retry delivery without duplicate messages',
      exact: true,
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
  await expect
    .element(decision.getByText('Decision 6 of 9', { exact: true }))
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

test('the closing page keeps Ready to merge behind every decision and the agent recommending Merge, and marks its files from the dock', async ({
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
    .toHaveTextContent('0 of 9 decisions reviewed');
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
  await expect
    .element(dock.getByText('Not explained', { exact: true }))
    .toBeVisible();
  await dock.getByRole('button', { name: /^Mark \d+ files? reviewed$/ }).click();
  await expect
    .element(
      dock.getByRole('button', { name: 'Every file reviewed', exact: true }),
    )
    .toBeDisabled();
  const unexplained = published.notExplained
    .filter((gap) => gap.ranges.length === 0)
    .map((gap) => gap.path)
    .toSorted();
  await expect
    .poll(async () => {
      const marks = await server.reviewMarks(published.reviewId ?? '');
      return marks.files.map((file) => file.path).toSorted();
    })
    .toEqual(unexplained);
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

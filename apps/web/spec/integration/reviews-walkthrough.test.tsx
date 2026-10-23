import { expect, test } from './fixtures.tsx';

test('the briefing keeps system owners and questions, the decisions open retained code, and Not explained stays a separate stop', async ({
  agent,
  render,
}) => {
  await agent.publishArchitecture();
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(
      review.getByRole('heading', {
        name: /9 decisions shape this change\./,
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      review.getByText('Needs your decision · Delivery outbox', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(review.getByText('Page-owned writes', { exact: true }))
    .toBeVisible();
  await review
    .getByRole('button', {
      name: '2. Revoke access across devices',
      exact: true,
    })
    .click();
  const revoke = review.getByRole('region', {
    name: '2. Revoke access across devices',
    exact: true,
  });
  await expect
    .element(
      revoke.getByRole('heading', {
        name: 'Revoke access across devices',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      revoke.getByText('Code moved since it was explained', { exact: true }),
    )
    .not.toBeInTheDocument();
  await review
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  await expect
    .element(review.getByRole('region', { name: 'Not explained', exact: true }))
    .toBeVisible();
  await review.getByRole('tab', { name: 'Agent summary', exact: true }).click();
  await expect
    .element(review.getByRole('tab', { name: 'Agent summary', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

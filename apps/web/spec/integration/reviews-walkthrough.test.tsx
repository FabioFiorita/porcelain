import { expect, test } from './fixtures.tsx';

test('a published review opens on a briefing of what the change adds, walks each decision through its code, ends with what no decision explains, and the sidebar leaves the agent summary for the stop it names', async ({
  workspace,
  agent,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer.getByRole('button', { name: 'Briefing', exact: true }).click();

  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(
      review.getByRole('heading', {
        name: '9 decisions shape this change',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(review.getByText('6 of 55 files reviewed', { exact: true }))
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
      name: 'Continue with 2. Revoke access across devices',
      exact: true,
    })
    .click();
  const revoke = review.getByRole('region', {
    name: '2. Revoke access across devices',
    exact: true,
  });
  await expect
    .element(
      revoke.getByText('Code moved since it was explained', { exact: true }),
    )
    .toBeVisible();
  await revoke
    .getByRole('button', {
      name: 'Go to step 3: Revoke through the session owner',
      exact: true,
    })
    .click();
  await expect
    .element(
      revoke.getByRole('complementary', {
        name: 'Agent note · Revoke through the session owner',
        exact: true,
      }),
    )
    .toBeVisible();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', {
      name: 'Not explained · 9 lines in 5 files 0/3',
      exact: true,
    })
    .click();
  const unexplained = review.getByRole('region', {
    name: 'Not explained',
    exact: true,
  });
  await expect
    .element(
      unexplained.getByText('scripts/migrate-workspaces.ts', { exact: true }),
    )
    .toBeVisible();
  await unexplained
    .getByRole('button', {
      name: 'Read in 9. Establish the shared mutation boundary',
      exact: true,
    })
    .click();
  await expect
    .element(
      review.getByRole('region', {
        name: '9. Establish the shared mutation boundary',
        exact: true,
      }),
    )
    .toBeVisible();
  await review.getByRole('tab', { name: 'Agent summary', exact: true }).click();
  await expect
    .element(review.getByRole('tab', { name: 'Agent summary', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', {
      name: '3 Publish an immutable note 0/6',
      exact: true,
    })
    .click();
  await expect
    .element(
      review.getByRole('region', {
        name: '3. Publish an immutable note',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(review.getByRole('tab', { name: 'Walkthrough', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

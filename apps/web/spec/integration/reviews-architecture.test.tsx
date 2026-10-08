import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a substantial review reveals shared owners, before and after, stale code and partial coverage independently of walkthrough progress', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Architecture overview', exact: true })
    .click();
  const overview = workspace.getByRole('region', {
    name: 'Published review',
    exact: true,
  });
  await expect
    .element(overview.getByRole('tab', { name: 'Architecture', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      overview.getByText('1 of 9 walkthroughs reviewed · 8 left', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .poll(async () => {
      const review = (await server.publishedReview()).review;
      return {
        walkthroughs: review?.layers.length,
        components: review?.diagram?.after.boxes.length,
        uncoveredPolicy: review?.notExplained.some(
          (gap) => gap.path === 'packages/workspace/src/policy.ts',
        ),
        uncoveredMigration: review?.notExplained.some(
          (gap) => gap.path === 'scripts/migrate-workspaces.ts',
        ),
      };
    })
    .toEqual({
      walkthroughs: 9,
      components: 13,
      uncoveredPolicy: true,
      uncoveredMigration: true,
    });
  await expect
    .element(overview.getByText('1 code location changed', { exact: true }))
    .toBeVisible();

  await expect
    .element(overview.getByText('uses', { exact: true }))
    .not.toBeInTheDocument();
  await overview
    .getByRole('combobox', {
      name: 'Select architecture component',
      exact: true,
    })
    .click();
  await page
    .getByRole('option', { name: 'Delivery outbox', exact: true })
    .click();
  await expect
    .element(overview.getByText('Showing 3 of 13 components', { exact: true }))
    .toBeVisible();
  await overview
    .getByRole('combobox', {
      name: 'Select architecture component',
      exact: true,
    })
    .click();
  await page
    .getByRole('option', { name: 'Select a component', exact: true })
    .click();
  await expect
    .element(overview.getByText('Showing 13 of 13 components', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      overview.getByRole('heading', { name: 'Delivery outbox', exact: true }),
    )
    .not.toBeInTheDocument();
  await overview
    .getByRole('combobox', {
      name: 'Select architecture component',
      exact: true,
    })
    .click();
  await page
    .getByRole('option', { name: 'Delivery outbox', exact: true })
    .click();
  await overview
    .getByRole('button', { name: 'Show entire map', exact: true })
    .click();
  const details = overview.getByRole('complementary', {
    name: 'Architecture details',
    exact: true,
  });
  await expect
    .element(
      details.getByText(
        'Outbox and journal are updated separately. Transaction ownership needs a decision.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect
    .element(
      details.getByRole('button', {
        name: 'Schedule reminders durably → uses',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      details.getByRole('button', {
        name: 'Retry delivery without duplicate messages → uses',
        exact: true,
      }),
    )
    .toBeVisible();
  await overview.getByRole('tab', { name: 'Before', exact: true }).click();
  await overview
    .getByRole('button', { name: 'Page-owned writes', exact: true })
    .click();
  await expect
    .element(
      details.getByText('Each page owns an independent write path.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await overview.getByRole('tab', { name: 'After', exact: true }).click();
  await expect
    .element(
      details.getByText(
        'The old write path is removed. Shared owners now decide mutations.',
        { exact: true },
      ),
    )
    .toBeVisible();

  await details
    .getByRole('button', { name: /Revoke access across devices/ })
    .click();
  const layer = workspace.getByRole('region', {
    name: 'Review layer Revoke access across devices',
    exact: true,
  });
  await layer.getByRole('tab', { name: 'Graph', exact: true }).click();
  await layer
    .getByRole('button', {
      name: 'Explore Keep the domain decision in its owner',
      exact: true,
    })
    .click();
  const code = workspace.getByRole('dialog', {
    name: 'Keep the domain decision in its owner',
    exact: true,
  });
  await expect
    .element(
      code.getByText(
        'Code changed since the review was written. Full current file changes are shown; the affected agent notes need updating.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect
    .element(
      code.getByRole('button', {
        name: 'Mark packages/workspace/src/revoke-access.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await code.getByRole('button', { name: 'Close', exact: true }).click();
  await expect
    .element(layer.getByRole('tab', { name: 'Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

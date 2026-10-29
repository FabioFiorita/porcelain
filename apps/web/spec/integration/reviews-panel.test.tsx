import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1440, 414])(
  'the review panel opens retained decisions and their steps at %s',
  async (width, { repo, render }) => {
    await page.viewport(width, 900);
    const first = await repo.review('Keep the first decision readable');
    await repo.review('Publish a replacement decision');
    await repo.removeReviewWorktree();
    const app = await render.route(`/reviews/${first.reviewId}/1`);
    const panel = app.page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    const open = async () => {
      if (width === 414)
        await app.page
          .getByRole('button', { name: 'Review', exact: true })
          .click();
    };
    try {
      await open();
      await expect
        .element(panel.getByRole('tab', { name: 'Explore', exact: true }))
        .toBeVisible();
      await expect
        .element(
          panel.getByRole('button', {
            name: '1 of 2 checks failing',
            exact: true,
          }),
        )
        .toHaveTextContent('Checks1 of 2 failing');
      await panel
        .getByRole('button', {
          name: '1 Keep the first decision readable 0/1',
          exact: true,
        })
        .click();
      await expect
        .poll(() => app.location())
        .toBe(`/reviews/${first.reviewId}/1/decisions/${first.layerId}`);
      await open();
      const steps = panel.getByRole('list', {
        name: 'Stops of decision 1',
        exact: true,
      });
      await expect.element(steps).toBeVisible();
      await steps
        .getByRole('button', { name: /^1 Read the retained revision/ })
        .click();
      const content = app.page.getByRole('article', {
        name: 'Step Read the retained revision',
        exact: true,
      });
      await expect
        .element(
          content.getByRole('button', {
            name: 'Back to the walkthrough',
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(
          content.getByText('export const revision = 1;', { exact: true }),
        )
        .toBeVisible();
      await open();
      await panel
        .getByRole('button', { name: 'Changed files', exact: true })
        .click();
      await expect
        .element(
          panel.getByRole('button', {
            name: 'Not reviewed retired.ts',
            exact: true,
          }),
        )
        .toBeVisible();
      await panel.getByRole('tab', { name: 'Comments', exact: true }).click();
      await expect
        .element(panel.getByText('No open comments yet.', { exact: true }))
        .toBeVisible();
      if (width === 414) {
        await userEvent.keyboard('{Escape}');
        await expect
          .element(
            app.page.getByRole('button', { name: 'Review', exact: true }),
          )
          .toHaveFocus();
      }
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test('worktree steps open the reviewed snapshot after the live file changes', async ({
  workspace,
  repo,
  agent,
}) => {
  await agent.publishReview('Retain the published code');
  await repo.write(repo.readme.path, 'The live checkout is different.\n');
  const panel = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const open = async () => {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await panel.getByRole('tab', { name: 'Review', exact: true }).click();
  };
  await open();
  await panel
    .getByRole('button', {
      name: '1 Retain the published code 0/1',
      exact: true,
    })
    .click();
  await open();
  await panel
    .getByRole('list', { name: 'Stops of decision 1', exact: true })
    .getByRole('button', { name: /^1 New line/ })
    .click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'Back to the walkthrough',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('article', { name: 'Step New line', exact: true })
        .getByText('A change to review.', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      workspace.getByText('The live checkout is different.', { exact: true }),
    )
    .not.toBeInTheDocument();
  await workspace
    .getByRole('button', { name: 'Back to the walkthrough', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await open();
  await expect
    .element(
      panel
        .getByRole('list', { name: 'Stops of decision 1', exact: true })
        .getByRole('checkbox', {
          name: `${repo.readme.path} reviewed`,
          exact: true,
        }),
    )
    .toBeChecked();
});

test('decision readiness includes unfinished decisions and requires their file marks', async ({
  workspace,
  repo,
  agent,
}) => {
  await agent.publishProof('Review the committed change', {
    checks: [{ name: 'Tests', result: 'pass' }],
    screenshot: 'Fixture',
  });
  const panel = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const open = async () => {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await panel.getByRole('tab', { name: 'Review', exact: true }).click();
  };
  await open();
  await panel
    .getByRole('button', {
      name: '1 Review the committed change 0/1',
      exact: true,
    })
    .click();
  await workspace
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await open();
  const readiness = panel.getByRole('region', {
    name: 'Readiness',
    exact: true,
  });
  await expect
    .element(
      readiness.getByRole('button', {
        name: '1 of 1 decisions reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await panel
    .getByRole('button', { name: 'More actions for decision 1', exact: true })
    .click();
  await workspace
    .getByRole('menuitem', { name: 'Unmark as reviewed', exact: true })
    .click();
  await expect
    .element(
      readiness.getByRole('button', {
        name: '0 of 1 decisions reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await panel
    .getByRole('button', { name: 'More actions for decision 1', exact: true })
    .click();
  await workspace
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await userEvent.keyboard('{Escape}');
  await workspace
    .getByRole('button', {
      name: `Unmark ${repo.readme.path} as unreviewed`,
      exact: true,
    })
    .click();
  await open();
  await expect
    .element(
      readiness.getByRole('button', {
        name: '0 of 1 decisions reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
});

test('a decision step marks its file reviewed and the header starts a whole-change comment', async ({
  workspace,
  repo,
  agent,
}) => {
  await agent.publishReview('Mark the step from the panel');
  const panel = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const open = async () => {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await panel.getByRole('tab', { name: 'Review', exact: true }).click();
  };
  await open();
  const decision = panel.getByRole('button', {
    name: /^1 Mark the step from the panel/,
  });
  await expect.element(decision).toBeVisible();
  await expect
    .element(panel.getByText('No changes', { exact: true }))
    .not.toBeInTheDocument();
  await decision.click();
  await open();
  const reviewed = panel
    .getByRole('list', { name: 'Stops of decision 1', exact: true })
    .getByRole('checkbox', {
      name: `${repo.readme.path} reviewed`,
      exact: true,
    });
  await expect.element(reviewed).not.toBeChecked();
  await reviewed.click();
  await expect.element(reviewed).toBeChecked();
  await reviewed.click();
  await expect.element(reviewed).not.toBeChecked();
  await panel
    .getByRole('button', { name: 'Comment on the whole change', exact: true })
    .click();
  await expect
    .element(panel.getByRole('textbox', { name: 'Comment', exact: true }))
    .toBeVisible();
});

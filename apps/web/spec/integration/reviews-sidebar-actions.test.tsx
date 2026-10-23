import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a sidebar decision menu marks its files and decision, unmarks only the decision, and is keyboard reachable', async ({
  workspace,
  agent,
  server,
  repo,
}) => {
  await agent.publishReview('Phone verification');
  await repo.write(
    repo.readme.path,
    `${repo.readme.changed}A follow-up edit.\n`,
  );
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const row = sidebar.getByRole('button', { name: /Phone verification/ });
  await expect.element(row).toHaveAccessibleName('1 Phone verification 0/1');
  await row.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Mark as reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await workspace
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({ files: [{ path: repo.readme.path }] });
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({
      decisions: [
        { layerId: (await server.publishedReview()).review?.layers[0]?.id },
      ],
    });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Unmark as reviewed', exact: true })
    .click();
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({ decisions: [] });
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({ files: [{ path: repo.readme.path }] });
  const actions = sidebar.getByRole('button', {
    name: 'More actions for decision 1',
    exact: true,
  });
  await expect
    .element(actions)
    .toHaveAccessibleDescription('Phone verification');
  await actions.click();
  await userEvent.keyboard('{Escape}');
  await expect.element(workspace.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(actions).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Mark as reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{End}');
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Mark as reviewed',
        exact: true,
      }),
    )
    .toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({
      decisions: [
        { layerId: (await server.publishedReview()).review?.layers[0]?.id },
      ],
    });
});

test('review groups collapse and expand all from their context menu and keyboard menu button', async ({
  workspace,
  repo,
}) => {
  await repo.write('phone-otp.spec.ts', 'test fixture\n');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const row = sidebar.getByRole('button', { name: /^README.md ·/ });
  await expect.element(row).toBeVisible();
  const group = sidebar.getByRole('button', {
    name: 'Changed files',
    exact: true,
  });
  await expect.element(group).toBeVisible();
  await group.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Collapse all', exact: true })
    .click();
  await expect.element(row).not.toBeInTheDocument();
  const actions = sidebar.getByRole('button', {
    name: 'Actions for Changed files',
    exact: true,
  });
  await actions.click();
  await userEvent.keyboard('{Escape}');
  await expect.element(workspace.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(actions).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await workspace
    .getByRole('menuitem', { name: 'Expand all', exact: true })
    .click();
  await expect.element(row).toBeVisible();
  await expect
    .element(sidebar.getByRole('button', { name: /^phone-otp.spec.ts ·/ }))
    .toBeVisible();
});

test('comment context menus resolve and reopen the thread and their keyboard menu starts a reply', async ({
  workspace,
  agent,
  server,
  repo,
}) => {
  await agent.comment(repo.readme.path, 'should be 5');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const thread = sidebar.getByRole('article', {
    name: 'Comment thread',
    exact: true,
  });
  await expect.element(thread).toBeVisible();
  await thread.click({ button: 'right' });
  await expect
    .element(workspace.getByRole('menuitem', { name: 'Resolve', exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('menuitem', { name: 'Resolve', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.resolved),
    )
    .toEqual([true]);
  await sidebar.getByRole('button', { name: /^resolved/i }).click();
  await sidebar
    .getByRole('article', { name: 'Resolved comment thread', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Reopen', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.resolved),
    )
    .toEqual([false]);
  await sidebar.getByRole('button', { name: /^open/i }).click();
  const actions = sidebar.getByRole('button', {
    name: 'Thread actions',
    exact: true,
  });
  await actions.click();
  await userEvent.keyboard('{Escape}');
  await expect.element(workspace.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(actions).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await workspace.getByRole('menuitem', { name: 'Reply', exact: true }).click();
  await expect
    .element(sidebar.getByRole('textbox', { name: 'Reply', exact: true }))
    .toBeVisible();
});

test('file menu buttons share the context review action and section menus open their document', async ({
  workspace,
  repo,
  server,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const fileActions = sidebar.getByRole('button', {
    name: `Actions for ${repo.readme.path}`,
    exact: true,
  });
  await expect.element(fileActions).toBeVisible();
  await fileActions.click();
  await workspace
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual([repo.readme.path]);
  await sidebar
    .getByRole('button', { name: /^README.md ·/ })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Unmark as reviewed', exact: true })
    .click();
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);
  await sidebar
    .getByRole('button', { name: 'All changes', exact: true })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: 'Open', exact: true }).click();
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('button', {
        name: `Mark ${repo.readme.path} as reviewed`,
        exact: true,
      }),
    )
    .toBeVisible();
});

import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('History lists each commit message without a graph beside it and marks a merge commit with a merge icon', async ({
  workspace,
  repo,
  server,
}) => {
  const topic = 'Add the topic notes';
  const long =
    'Describe every step the reviewer takes before approving the change';
  await repo.branch('topic');
  await repo.switch('topic');
  await repo.write('topic.md', '# Topic\n');
  await repo.commit(topic);
  await repo.switch(repo.initialBranch);
  await repo.write('steps.md', '# Steps\n');
  await repo.commit(long);
  await repo.merge('topic');
  await expect
    .poll(async () => (await server.commits()).commits[0]?.parentOids.length)
    .toBe(2);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const merge = sidebar.getByRole('button', {
    name: /^Merge commit ?Merge branch 'topic'/,
  });
  await expect
    .element(merge.getByRole('img', { name: 'Merge commit', exact: true }))
    .toBeVisible();
  const described = sidebar.getByRole('button', {
    name: new RegExp(`^${long}`),
  });
  await expect
    .element(described.getByText(long, { exact: true }))
    .toBeVisible();
  await expect
    .element(described.getByRole('img', { name: 'Merge commit', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(sidebar.getByText('topic', { exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('list', { name: 'Commit graph', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(sidebar.getByRole('button', { name: 'Open graph', exact: true }))
    .toBeVisible();
});

test('every ref is reachable at a narrow width in the History list and graph', async ({
  workspace,
  repo,
  server,
  refChips,
}) => {
  const branches = [
    'experiment/aaa-very-long-branch-name-that-overflows-the-history-chip-row',
    'experiment/bbb-another-long-name-for-the-same-commit',
    'experiment/ccc-one-more-long-name-for-the-same-commit',
  ];
  for (const branch of branches) await repo.branch(branch);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.refs.length)
    .toBe(4);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();

  for (const surface of ['list', 'graph'] as const) {
    const scope =
      surface === 'list'
        ? workspace.getByRole('complementary', {
            name: 'Review sidebar',
            exact: true,
          })
        : workspace.getByRole('list', { name: 'Commit graph', exact: true });
    await expect
      .element(scope.getByText(repo.initialBranch, { exact: true }).last())
      .toBeVisible();
    const first = scope.getByText(branches[2]!, { exact: true });
    await expect.element(first).toBeVisible();
    const row = scope.getByRole('button', { name: /^Initial commit/ });
    const more = scope.getByRole('button', { name: /^Show \d+ more refs$/ });
    await expect.element(more).toBeVisible();
    await expect
      .poll(() => refChips.presentation(first, row, more))
      .toEqual({
        textOverflow: 'ellipsis',
        truncated: true,
        nameInsideRow: true,
        countInsideRow: true,
      });
    refChips.focus(row);
    await userEvent.keyboard('{Tab}{Tab}');
    await expect.poll(() => refChips.tooltipName()).toBe(branches[2]!);
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('{Tab}{Enter}');
    const remaining = workspace.getByRole('dialog', {
      name: 'More refs',
      exact: true,
    });
    for (const branch of [branches[0]!, branches[1]!]) {
      await expect
        .element(remaining.getByText(branch, { exact: true }))
        .toBeVisible();
    }
    await userEvent.keyboard('{Escape}');
    await expect.element(remaining).not.toBeInTheDocument();
    await expect.element(more).toHaveFocus();
    if (surface === 'list') {
      await scope
        .getByRole('button', { name: 'Open graph', exact: true })
        .click();
    }
  }
  await workspace
    .getByRole('list', { name: 'Commit graph', exact: true })
    .getByRole('button', { name: repo.initialBranch, exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
    )
    .toBeVisible();
});

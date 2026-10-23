import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([414, 1280])(
  'History lists each commit on its graph line and marks a merge commit with a merge icon at %i px',
  async (width, { workspace, repo }) => {
    await page.viewport(width, 896);
    try {
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

      if (width === 414)
        await workspace
          .getByRole('button', { name: 'Review', exact: true })
          .click();
      await workspace
        .getByRole('tab', { name: 'History', exact: true })
        .click();
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
      for (const subject of [long, topic, repo.initialCommit]) {
        const row = sidebar.getByRole('button', {
          name: new RegExp(`^${subject}`),
        });
        await expect
          .element(row.getByText(subject, { exact: true }))
          .toBeVisible();
        await expect
          .element(row.getByRole('img', { name: 'Merge commit', exact: true }))
          .not.toBeInTheDocument();
      }
      await expect
        .element(sidebar.getByText('topic', { exact: true }))
        .toBeVisible();
      await expect
        .element(sidebar.getByRole('list', { name: 'Commits', exact: true }))
        .toBeVisible();
      await expect
        .element(sidebar.getByTestId('history-graph'))
        .toBeVisible();
      await expect
        .element(
          sidebar.getByRole('button', { name: 'Open graph', exact: true }),
        )
        .toBeVisible();
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test.for([414, 1280])(
  'History opens an off-screen row and adds a live commit at %i px',
  async (width, { render, repo }) => {
    await page.viewport(width, 896);
    try {
      for (let index = 1; index <= 24; index++) {
        await repo.write('notes.md', `Step ${index}\n`);
        await repo.commit(`Write step ${index}`);
      }
      const workspace = await render.workspace();
      if (width === 414)
        await workspace
          .getByRole('button', { name: 'Review', exact: true })
          .click();
      await workspace
        .getByRole('tab', { name: 'History', exact: true })
        .click();
      const sidebar = workspace.getByRole('complementary', {
        name: 'Review sidebar',
        exact: true,
      });
      await expect
        .element(sidebar.getByRole('button', { name: /^Write step 24 / }))
        .toBeVisible();
      await repo.write('notes.md', 'Added while History is open\n');
      await repo.commit('Add a live commit');
      const added = sidebar.getByRole('button', {
        name: /^Add a live commit /,
      });
      await expect.element(added).toBeVisible();
      await expect
        .element(added.getByRole('img', { name: 'Merge commit', exact: true }))
        .not.toBeInTheDocument();
      const initial = sidebar.getByRole('button', { name: /^Initial commit / });
      await expect.element(initial).toBeInTheDocument();
      await initial.click();
      await expect
        .element(
          workspace.getByRole('heading', {
            name: 'Initial commit',
            exact: true,
          }),
        )
        .toBeVisible();
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test('every ref is reachable at a narrow width in the History list and graph', async ({
  workspace,
  repo,
  refChips,
}) => {
  const branches = [
    'experiment/aaa-very-long-branch-name-that-overflows-the-history-chip-row',
    'experiment/bbb-another-long-name-for-the-same-commit',
    'experiment/ccc-one-more-long-name-for-the-same-commit',
  ];
  for (const branch of branches) await repo.branch(branch);

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

import { expect, test } from './fixtures.tsx';

test('a whole-branch comment being written survives a new commit and is saved at the new tip', async ({
  workspace,
  repo,
  server,
}) => {
  const draft = 'Split the notes before merging';
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  await workspace.getByRole('tab', { name: 'Comments', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Branch', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: 'Comment on the whole branch', exact: true })
    .click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await comment.fill(draft);

  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.commit('Extend notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(2);
  const tip = (await server.branchChanges()).head.oid;
  await expect
    .element(
      workspace.getByText(`Whole branch · at ${tip.slice(0, 7)}`, {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(comment).toHaveValue(draft);

  await workspace.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .element(workspace.getByText(draft, { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.anchor.revision),
    )
    .toEqual([tip]);
});

test('retrying a saved branch comment after a lost response and a new head keeps its first target and identity', async ({
  repo,
  server,
  render,
  fetchGate,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  const firstTip = (await server.branchChanges()).head.oid;
  fetchGate.loseNextPostResponse('/comments');
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await sidebar.getByRole('tab', { name: 'Changes', exact: true }).click();
  await sidebar.getByRole('tab', { name: 'Branch', exact: true }).click();
  await sidebar.getByRole('tab', { name: /^Comments/ }).click();
  await sidebar
    .getByRole('button', { name: 'Comment on the whole branch', exact: true })
    .click();
  const comment = sidebar.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const post = sidebar.getByRole('button', { name: 'Comment', exact: true });
  const body = 'Keep this feedback on the head I first sent.';
  await comment.fill(body);
  await post.click();
  await expect.element(sidebar.getByRole('alert')).toBeVisible();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.anchor.revision),
    )
    .toEqual([firstTip]);
  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.commit('Extend notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(2);
  await sidebar
    .getByRole('tab', { name: 'Changed files', exact: true })
    .click();
  await expect
    .element(sidebar.getByText(/^2 commits on feature since /))
    .toBeVisible();
  await sidebar.getByRole('tab', { name: /^Comments/ }).click();
  await sidebar
    .getByRole('button', { name: 'Comment on the whole branch', exact: true })
    .click();
  await expect.element(comment).toHaveValue(body);
  await expect
    .element(
      sidebar.getByText(`Whole branch · at ${firstTip.slice(0, 7)}`, {
        exact: true,
      }),
    )
    .toBeVisible();
  await post.click();
  await expect.element(comment).not.toBeInTheDocument();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => ({
        revision: thread.anchor.revision,
        messages: thread.messages.map((message) => message.body),
      })),
    )
    .toEqual([{ revision: firstTip, messages: [body] }]);
});

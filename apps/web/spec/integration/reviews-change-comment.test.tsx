import { expect, test } from './fixtures.tsx';

test('the reviewer comments on the whole uncommitted change and then on the whole branch', async ({
  workspace,
  repo,
  server,
}) => {
  const onChange = 'Split this into two commits';
  const onBranch = 'Ready to merge once the notes are in';
  const saved = async () =>
    (await server.commentThreads()).map((thread) => ({
      anchor: thread.anchor,
      messages: thread.messages.map((message) => message.body),
    }));

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Comments', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Comment on the whole change', exact: true })
    .click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const post = workspace.getByRole('button', { name: 'Comment', exact: true });
  await expect
    .element(workspace.getByText('Whole change', { exact: true }).first())
    .toBeVisible();
  await expect.element(post).toBeDisabled();
  await comment.fill(onChange);
  await post.click();
  await expect
    .element(workspace.getByText(onChange, { exact: true }))
    .toBeVisible();
  await expect
    .poll(saved)
    .toEqual([{ anchor: { kind: 'change' }, messages: [onChange] }]);

  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);
  const tip = (await server.branchChanges()).head.oid;
  await workspace.getByRole('tab', { name: 'Branch', exact: true }).click();
  const branchComment = workspace.getByRole('button', {
    name: 'Comment on the whole branch',
    exact: true,
  });
  await expect.element(branchComment).toBeEnabled();
  await branchComment.click();
  await comment.fill(onBranch);
  await post.click();
  await expect
    .element(workspace.getByText(onBranch, { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('Whole branch', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual([
    { anchor: { kind: 'change' }, messages: [onChange] },
    {
      anchor: {
        kind: 'change',
        comparison: { kind: 'branch', base: 'refs/heads/main' },
        revision: tip,
      },
      messages: [onBranch],
    },
  ]);
});

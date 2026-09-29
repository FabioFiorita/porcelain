import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the reviewer comments on the whole uncommitted change and then on the whole branch', async ({
  pairedPage,
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

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Comments' }).click();
  await pairedPage
    .getByRole('button', { name: 'Comment on the whole change' })
    .click();
  const comment = pairedPage.getByRole('textbox', { name: 'Comment' });
  const post = pairedPage.getByRole('button', { name: 'Comment', exact: true });
  await expect
    .element(pairedPage.getByText('Whole change').first())
    .toBeVisible();
  await expect.element(post).toBeDisabled();
  await comment.fill(onChange);
  await post.click();
  await expect.element(pairedPage.getByText(onChange)).toBeVisible();
  await expect
    .poll(saved)
    .toEqual([{ anchor: { kind: 'change' }, messages: [onChange] }]);

  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);
  const tip = (await server.branchChanges()).head.oid;
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  const branchComment = pairedPage.getByRole('button', {
    name: 'Comment on the whole branch',
  });
  await expect.element(branchComment).toBeEnabled();
  await branchComment.click();
  await comment.fill(onBranch);
  await post.click();
  await expect.element(pairedPage.getByText(onBranch)).toBeVisible();
  await expect.element(pairedPage.getByText('Whole branch')).toBeVisible();
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

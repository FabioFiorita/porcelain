import { expect, test } from './fixtures.tsx';

test('a resolved thread the agent answers while the reviewer confirms the deletion is kept and the dialog says so', async ({
  workspace,
  server,
  agent,
}) => {
  const mine = 'Split this into two commits';
  const late = 'Done, split into two commits';
  const saved = async () =>
    (await server.commentThreads()).map((thread) =>
      thread.messages.map((message) => message.body),
    );

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  const comments = workspace.getByRole('dialog');
  await comments
    .getByRole('button', { name: 'Comment on the whole change', exact: true })
    .click();
  await comments
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill(mine);
  await comments.getByRole('button', { name: 'Comment', exact: true }).click();
  await comments.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.resolved),
    )
    .toEqual([true]);

  await comments.getByRole('button', { name: /^resolved/i }).click();
  await comments
    .getByRole('button', { name: 'Delete resolved', exact: true })
    .click();
  const confirm = workspace.getByRole('alertdialog');
  await expect
    .element(confirm.getByText('Delete 1 resolved thread?', { exact: true }))
    .toBeVisible();
  const [thread] = await server.commentThreads();
  await agent.reply(thread?.id ?? '', late);
  await expect.poll(saved).toEqual([[mine, late]]);

  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect
    .element(confirm.getByText('Kept 1 thread that changed', { exact: true }))
    .toBeVisible();
  await confirm.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.element(confirm).not.toBeInTheDocument();
  await expect.poll(saved).toEqual([[mine, late]]);
});

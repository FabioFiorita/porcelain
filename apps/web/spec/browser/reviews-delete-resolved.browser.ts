import { expect } from 'vitest';
import { test } from '../kit/journey';

test("the reviewer deletes the resolved threads they started after confirming, and the agent's resolved thread stays", async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const fromAgent = 'I kept the old heading in the changelog';
  const mine = 'Split this into two commits';
  const saved = async () =>
    (await server.commentThreads()).map((thread) => ({
      resolved: thread.resolved,
      messages: thread.messages.map((message) => message.body),
    }));

  await agent.comment(repo.readme.path, fromAgent);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: /^Comments/ }).click();
  const comments = pairedPage.getByRole('dialog');
  await expect
    .element(comments.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await comments
    .getByRole('button', { name: 'Comment on the whole change', exact: true })
    .click();
  await comments
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill(mine);
  await comments.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect.element(comments.getByText(mine, { exact: true })).toBeVisible();
  const openThread = (body: string) =>
    comments
      .getByRole('article', { name: 'Comment thread', exact: true })
      .filter({ hasText: body });
  await openThread(fromAgent)
    .getByRole('button', { name: 'Resolve', exact: true })
    .click();
  await openThread(mine)
    .getByRole('button', { name: 'Resolve', exact: true })
    .click();
  await expect
    .element(comments.getByText('No open comments yet.', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual([
    { resolved: true, messages: [fromAgent] },
    { resolved: true, messages: [mine] },
  ]);

  await comments.getByRole('button', { name: /^resolved/i }).click();
  await comments
    .getByRole('button', { name: 'Delete resolved', exact: true })
    .click();
  const confirm = pairedPage.getByRole('alertdialog');
  await expect
    .element(confirm.getByText('Delete 1 resolved thread?', { exact: true }))
    .toBeVisible();
  await expect
    .element(confirm.getByText(/1 resolved thread the agent started stays/))
    .toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.element(comments.getByText(mine, { exact: true })).toBeVisible();

  await comments
    .getByRole('button', { name: 'Delete resolved', exact: true })
    .click();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.element(confirm).not.toBeInTheDocument();
  await expect
    .element(comments.getByText(mine, { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(comments.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual([{ resolved: true, messages: [fromAgent] }]);
  await expect
    .element(
      comments.getByRole('button', { name: 'Delete resolved', exact: true }),
    )
    .toBeDisabled();
});

import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const stale =
  'The worktree changed since this draft was proposed. Generate it again before committing.';

test('a draft the worktree moved past is refused, and after looking again the dialog says it is stale until it is generated again', async ({
  codingTool,
  pairedPage,
  repo,
  server,
}) => {
  const drafted = (await codingTool.install()).message.message;
  await repo.write(repo.readme.path, 'Drafted content\n');
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  const generate = dialog.getByRole('button', { name: 'Generate with AI' });
  const commit = dialog.getByRole('button', { name: 'Commit selected files' });
  await generate.click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message' }))
    .toHaveValue(drafted);

  await repo.write(repo.readme.path, 'Changed after the draft\n');
  await commit.click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await dialog.getByRole('button', { name: 'Look again' }).click();
  await expect.element(dialog.getByText(stale)).toBeVisible();
  await expect.element(commit).toBeDisabled();

  await generate.click();
  await expect.element(dialog.getByText(stale)).not.toBeInTheDocument();
  await commit.click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(drafted);
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
});

test('a draft of content that changed after the dialog opened is flagged at once, and looking again lets it commit', async ({
  codingTool,
  pairedPage,
  repo,
  server,
}) => {
  const drafted = (await codingTool.install()).message.message;
  const opener = pairedPage.getByRole('button', {
    name: 'Commit',
    exact: true,
  });
  await repo.write(repo.readme.path, 'Seen when the dialog opened\n');
  await expect.element(opener).toBeEnabled();
  await opener.click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  const commit = dialog.getByRole('button', { name: 'Commit selected files' });
  await expect
    .element(dialog.getByText(repo.readme.path, { exact: true }))
    .toBeVisible();

  await repo.write(repo.readme.path, 'Changed before the draft\n');
  await dialog.getByRole('button', { name: 'Generate with AI' }).click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message' }))
    .toHaveValue(drafted);
  await expect.element(dialog.getByText(stale)).toBeVisible();
  await expect.element(commit).toBeDisabled();

  await dialog.getByRole('button', { name: 'Look again' }).click();
  await expect.element(dialog.getByText(stale)).not.toBeInTheDocument();
  await commit.click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(drafted);
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe('Changed before the draft\n');
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);
});

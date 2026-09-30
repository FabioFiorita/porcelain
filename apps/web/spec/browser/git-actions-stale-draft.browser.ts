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
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const generate = dialog.getByRole('button', {
    name: 'Generate with AI',
    exact: true,
  });
  const commit = dialog.getByRole('button', {
    name: 'Commit selected files',
    exact: true,
  });
  await generate.click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message', exact: true }))
    .toHaveValue(drafted);

  await repo.write(repo.readme.path, 'Changed after the draft\n');
  await commit.click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await dialog.getByRole('button', { name: 'Look again', exact: true }).click();
  await expect.element(dialog.getByText(stale, { exact: true })).toBeVisible();
  await expect.element(commit).toBeDisabled();
  await dialog.getByRole('tab', { name: 'Amend last', exact: true }).click();
  await pairedPage
    .getByRole('dialog', { name: 'Amend last commit', exact: true })
    .getByRole('tab', { name: 'Single commit', exact: true })
    .click();
  await expect.element(dialog.getByText(stale, { exact: true })).toBeVisible();
  await expect.element(commit).toBeDisabled();

  await generate.click();
  await expect
    .element(dialog.getByText(stale, { exact: true }))
    .not.toBeInTheDocument();
  await commit.click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
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
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const commit = dialog.getByRole('button', {
    name: 'Commit selected files',
    exact: true,
  });
  await expect
    .element(dialog.getByText(repo.readme.path, { exact: true }))
    .toBeVisible();

  await repo.write(repo.readme.path, 'Changed before the draft\n');
  await dialog
    .getByRole('button', { name: 'Generate with AI', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message', exact: true }))
    .toHaveValue(drafted);
  await expect.element(dialog.getByText(stale, { exact: true })).toBeVisible();
  await expect.element(commit).toBeDisabled();

  await dialog.getByRole('button', { name: 'Look again', exact: true }).click();
  await expect
    .element(dialog.getByText(stale, { exact: true }))
    .not.toBeInTheDocument();
  await commit.click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(drafted);
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe('Changed before the draft\n');
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
});

test('when the file of a later group changes after the groups were drafted, looking again after its refusal flags the remaining groups as stale', async ({
  codingTool,
  pairedPage,
  repo,
}) => {
  const { groups } = await codingTool.install();
  const later = groups[1]?.paths[0] ?? '';
  for (const group of groups)
    for (const path of group.paths)
      await repo.write(path, `${path} drafted in groups\n`);
  await expect
    .element(pairedPage.getByRole('button', { name: 'Commit', exact: true }))
    .toBeEnabled();
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  for (const path of groups.flatMap((group) => group.paths))
    await expect.element(dialog.getByText(path, { exact: true })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Use groups', exact: true }).click();
  await expect
    .element(
      dialog.getByRole('textbox', {
        name: 'Message for commit 1',
        exact: true,
      }),
    )
    .toHaveValue(groups[0]?.message ?? '');

  await repo.write(later, 'Changed after the groups were drafted\n');
  const commit = dialog.getByRole('button', {
    name: 'Commit groups in order',
    exact: true,
  });
  await commit.click();
  await expect
    .element(dialog.getByText('Commit 1 · committed', { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await dialog.getByRole('button', { name: 'Look again', exact: true }).click();
  await expect.element(dialog.getByText(stale, { exact: true })).toBeVisible();
  await expect.element(commit).toBeDisabled();
});

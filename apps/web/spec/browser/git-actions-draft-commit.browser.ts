import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('with a coding CLI the chosen model drafts the message, and the drafted commit becomes the newest', async ({
  codingTool,
  pairedPage,
  server,
}) => {
  const drafted = (await codingTool.install()).message.message;
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const models = dialog.getByRole('combobox', {
    name: 'Commit model',
    exact: true,
  });
  await expect.element(models).toBeEnabled();
  await models.selectOptions('Haiku');
  await expect.element(models).toHaveDisplayValue('Haiku');

  await dialog
    .getByRole('button', { name: 'Generate with AI', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message', exact: true }))
    .toHaveValue(drafted);
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(drafted);
  await userEvent.keyboard('{Escape}');
});

test('Use groups drafts one commit per group, and committing lands them in order', async ({
  codingTool,
  pairedPage,
  repo,
  server,
}) => {
  const { groups } = await codingTool.install();
  for (const group of groups)
    for (const path of group.paths)
      await repo.write(path, `${path} drafted in groups\n`);
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  for (const path of groups.flatMap((group) => group.paths))
    await expect.element(dialog.getByText(path, { exact: true })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Use groups', exact: true }).click();
  for (const [index, group] of groups.entries())
    await expect
      .element(
        dialog.getByRole('textbox', {
          name: `Message for commit ${index + 1}`,
          exact: true,
        }),
      )
      .toHaveValue(group.message);
  await dialog
    .getByRole('button', { name: 'Commit groups in order', exact: true })
    .click();
  await expect
    .element(
      dialog.getByText(`Commit ${groups.length} · committed`, { exact: true }),
    )
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.commits()).commits
        .slice(0, groups.length)
        .map((commit) => commit.subject),
    )
    .toEqual(groups.map((group) => group.message).toReversed());
  await userEvent.keyboard('{Escape}');
});

test('a commit the worktree has moved past since the draft is refused, and a new draft must cover every selected file', async ({
  codingTool,
  pairedPage,
  repo,
  server,
}) => {
  const drafted = (await codingTool.install()).message.message;
  const later = 'LATER.md';
  await repo.write(repo.readme.path, 'Changed before the draft\n');
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const uncovered = dialog.getByText(
    'The generated groups did not cover the selected files. Generate again or write the message manually.',
    { exact: true },
  );
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
  await repo.write(later, 'Written after the draft\n');
  await commit.click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await expect
    .element(dialog.getByRole('button', { name: 'Look again', exact: true }))
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.changes()).changes.map((change) => change.path),
    )
    .toEqual([later, repo.readme.path]);

  await dialog.getByRole('button', { name: 'Look again', exact: true }).click();
  await expect.element(dialog.getByText(later, { exact: true })).toBeVisible();

  await generate.click();
  await expect.element(uncovered).toBeVisible();

  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByRole('checkbox', { name: later, exact: true }).click();
  await generate.click();
  await expect.element(uncovered).not.toBeInTheDocument();
  await commit.click();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(drafted);
  await expect
    .poll(async () =>
      (await server.changes()).changes.map((change) => change.path),
    )
    .toEqual([later]);
});

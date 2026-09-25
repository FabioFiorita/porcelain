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
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  const models = dialog.getByRole('combobox', { name: 'Commit model' });
  await expect.element(models).toBeEnabled();
  await models.selectOptions('Haiku');
  await expect.element(models).toHaveDisplayValue('Haiku');

  await dialog.getByRole('button', { name: 'Generate with AI' }).click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message' }))
    .toHaveValue(drafted);
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
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
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  for (const path of groups.flatMap((group) => group.paths))
    await expect.element(dialog.getByText(path, { exact: true })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Use groups' }).click();
  for (const [index, group] of groups.entries())
    await expect
      .element(
        dialog.getByRole('textbox', {
          name: `Message for commit ${index + 1}`,
        }),
      )
      .toHaveValue(group.message);
  await dialog.getByRole('button', { name: 'Commit groups in order' }).click();
  await expect
    .element(dialog.getByText(`Commit ${groups.length} · committed`))
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
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  const uncovered = dialog.getByText(
    'The generated groups did not cover the selected files. Generate again or write the message manually.',
  );
  const generate = dialog.getByRole('button', { name: 'Generate with AI' });
  const commit = dialog.getByRole('button', { name: 'Commit selected files' });
  await generate.click();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Message' }))
    .toHaveValue(drafted);

  await repo.write(repo.readme.path, 'Changed after the draft\n');
  await repo.write(later, 'Written after the draft\n');
  await commit.click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await expect
    .element(dialog.getByRole('button', { name: 'Look again' }))
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.changes()).changes.map((change) => change.path),
    )
    .toEqual([later, repo.readme.path]);

  await dialog.getByRole('button', { name: 'Look again' }).click();
  await expect.element(dialog.getByText(later, { exact: true })).toBeVisible();

  await generate.click();
  await expect.element(uncovered).toBeVisible();

  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByRole('checkbox', { name: later }).click();
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

import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('right-clicking a changed file marks it reviewed, starts a comment on it and opens its timeline', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  const row = workspace.getByRole('button', {
    name: new RegExp(`^${readme.replace('.', '\\.')}( · .+)?$`),
  });

  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await expect.poll(marked).toContain(readme);
  await row.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Unmark as reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');

  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Comment', exact: true })
    .click();
  await expect
    .element(workspace.getByRole('textbox', { name: 'Comment', exact: true }))
    .toBeVisible();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Show timeline', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('list', {
        name: `Timeline of ${readme}`,
        exact: true,
      }),
    )
    .toBeVisible();
}, 30_000);

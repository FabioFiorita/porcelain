import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('right-clicking a changed file marks it reviewed and opens its timeline without a Comment action', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  const row = workspace.getByRole('button', {
    name: new RegExp(`^${readme.replace('.', '\\.')}( · .+)?$`),
  });
  await expect
    .element(row)
    .toHaveAccessibleDescription('Modified · Not reviewed');

  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await expect.poll(marked).toContain(readme);
  await expect.element(row).toHaveAccessibleDescription('Modified · Reviewed');
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
  await expect
    .element(workspace.getByRole('menuitem', { name: 'Comment', exact: true }))
    .not.toBeInTheDocument();
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

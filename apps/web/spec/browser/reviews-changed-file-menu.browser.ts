import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('right-clicking a changed file marks it reviewed, starts a comment on it and opens its timeline', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  const row = pairedPage.getByRole('button', {
    name: new RegExp(`^${readme.replace('.', '\\.')}( · .+)?$`),
  });

  await row.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
    .click();
  await expect.poll(marked).toContain(readme);
  await row.click({ button: 'right' });
  await expect
    .element(
      pairedPage.getByRole('menuitem', {
        name: 'Unmark as reviewed',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');

  await row.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Comment', exact: true })
    .click();
  await expect
    .element(pairedPage.getByRole('textbox', { name: 'Comment', exact: true }))
    .toBeVisible();

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await row.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Show timeline', exact: true })
    .click();
  await expect
    .element(
      pairedPage.getByRole('list', {
        name: `Timeline of ${readme}`,
        exact: true,
      }),
    )
    .toBeVisible();
}, 30_000);

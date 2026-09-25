import { expect } from 'vitest';
import { test } from '../kit/journey';

test('opening a commit from History shows its message, its file and the diff of the line it added', async ({
  pairedPage,
  repo,
  server,
}) => {
  const subject = 'Explain the change to review';
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History' }).click();
  await pairedPage.getByRole('button', { name: subject, exact: false }).click();
  await expect
    .element(pairedPage.getByRole('heading', { name: subject }))
    .toBeVisible();
  await expect.element(pairedPage.getByText('1 file changed')).toBeVisible();
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();
});

test('a binary file in a commit is listed without a code preview and says it is a binary change', async ({
  pairedPage,
  repo,
  server,
}) => {
  const subject = 'Add a binary logo';
  const logo = 'logo.bin';
  await repo.write(logo, 'PNG\u0000\u0001\u0002binary');
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History' }).click();
  await pairedPage.getByRole('button', { name: subject, exact: false }).click();
  await expect
    .element(pairedPage.getByRole('heading', { name: subject }))
    .toBeVisible();
  const withoutPreview = pairedPage.getByRole('list', {
    name: 'Changes without code preview',
  });
  await expect.element(withoutPreview.getByText(logo)).toBeVisible();
  await expect
    .element(withoutPreview.getByText('added · Binary change'))
    .toBeVisible();
});

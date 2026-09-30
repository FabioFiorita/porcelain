import { expect } from 'vitest';
import { test } from '../kit/journey';

test("copying a commit's id and message from its History row and its document", async ({
  pairedPage,
  repo,
  server,
}) => {
  const subject = 'Explain the change to review';
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  const oid = (await server.commits()).commits[0]?.oid ?? '';
  const copied = (label: string) =>
    pairedPage.getByText(`Copied ${label}`, { exact: true }).last();

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History', exact: true }).click();
  const row = pairedPage.getByRole('button', {
    name: new RegExp(`^${subject}`),
  });
  await row.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Copy commit id', exact: true })
    .click();
  await expect.element(copied('commit id')).toBeVisible();
  await expect
    .element(pairedPage.getByText(oid, { exact: true }))
    .toBeVisible();

  await row.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Copy message', exact: true })
    .click();
  await expect.element(copied('commit message')).toBeVisible();

  await row.click();
  await expect
    .element(pairedPage.getByRole('heading', { name: subject, exact: true }))
    .toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Copy message', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText(subject, { exact: true }).last())
    .toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Copy id', exact: true })
    .click();
  await expect.element(copied('commit id')).toBeVisible();
});

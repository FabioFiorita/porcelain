import { expect, test } from './fixtures.tsx';

test("copying a commit's id and message from its History row and its document", async ({
  workspace,
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
    workspace.getByText(`Copied ${label}`, { exact: true }).last();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  const row = workspace.getByRole('button', {
    name: new RegExp(`^${subject}`),
  });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Copy commit id', exact: true })
    .click();
  await expect.element(copied('commit id')).toBeVisible();
  await expect.element(workspace.getByText(oid, { exact: true })).toBeVisible();

  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Copy message', exact: true })
    .click();
  await expect.element(copied('commit message')).toBeVisible();

  await row.click();
  await expect
    .element(workspace.getByRole('heading', { name: subject, exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Copy message', exact: true })
    .click();
  await expect
    .element(workspace.getByText(subject, { exact: true }).last())
    .toBeVisible();
  await workspace.getByRole('button', { name: 'Copy id', exact: true }).click();
  await expect.element(copied('commit id')).toBeVisible();
});

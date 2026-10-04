import { expect, test } from './fixtures.tsx';

test('opening the root commit shows its added file and patch against the empty tree', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace.getByRole('button', { name: /^Initial commit/ }).click();
  await expect
    .element(
      workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByText('root commit', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 file changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText(repo.readme.committed.trim(), { exact: true }))
    .toBeVisible();
  await workspace.screenshot({
    path: '../../test-results/integration/screenshots/root-commit.png',
  });
});

test('opening a commit from History shows its message, its file and the diff of the line it added', async ({
  workspace,
  repo,
  server,
}) => {
  const subject = 'Explain the change to review';
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: new RegExp(`^${subject}`) })
    .click();
  await expect
    .element(workspace.getByRole('heading', { name: subject, exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 file changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});

test('a binary file in a commit is listed without a code preview and says it is a binary change', async ({
  workspace,
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
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: new RegExp(`^${subject}`) })
    .click();
  await expect
    .element(workspace.getByRole('heading', { name: subject, exact: true }))
    .toBeVisible();
  const withoutPreview = workspace.getByRole('list', {
    name: 'Changes without code preview',
    exact: true,
  });
  await expect
    .element(withoutPreview.getByText(logo, { exact: true }))
    .toBeVisible();
  await expect
    .element(withoutPreview.getByText('added · Binary change', { exact: true }))
    .toBeVisible();
});

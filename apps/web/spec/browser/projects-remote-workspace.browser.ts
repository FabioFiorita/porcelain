import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the desktop app lists a remote computer under its name in the sidebar, opens its worktree, marks a change reviewed there and shows what changes on it live', async ({
  pairedPage,
  app,
  server,
  repo,
}) => {
  const inventory = await server.inventory();
  const host = inventory.environment.name;
  const sample = await server.project();
  const main = sample.worktrees.find((worktree) => worktree.main);
  const readme = repo.readme.path;
  const rewritten = 'Rewritten on the remote computer while it is open.';

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await settings
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect
    .element(
      settings
        .getByRole('list', { name: 'Remote computers', exact: true })
        .getByRole('listitem', { name: host, exact: true }),
    )
    .toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect
    .element(
      pairedPage
        .getByRole('group', { name: 'This computer', exact: true })
        .getByRole('button', { name: sample.name, exact: true }),
    )
    .toBeVisible();
  const remote = pairedPage.getByRole('group', { name: host, exact: true });
  await expect
    .element(remote.getByText('Online', { exact: true }))
    .toBeVisible();
  await expect
    .element(remote.getByRole('button', { name: sample.name, exact: true }))
    .toBeVisible();
  await remote.getByRole('button', { name: /Main worktree/ }).click();
  await expect
    .poll(() => app.address().path)
    .toBe(`/remotes/${inventory.environmentId}/${sample.id}/${main?.id ?? ''}`);

  const mark = pairedPage.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  await expect.element(mark).toBeVisible();
  await mark.click();
  await expect
    .element(
      pairedPage.getByRole('button', {
        name: `Unmark ${readme} as unreviewed`,
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((entry) => entry.path),
    )
    .toContain(readme);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  const source = pairedPage.getByRole('tab', { name: 'Source', exact: true });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
  await repo.write(readme, `# Sample repository\n\n${rewritten}\n`);
  await expect
    .poll(async () => (await server.text(readme)).text)
    .toContain(rewritten);
  await expect
    .element(pairedPage.getByText(rewritten, { exact: true }))
    .toBeVisible();
}, 30_000);

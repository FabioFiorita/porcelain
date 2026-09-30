import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the desktop app lists another computer under its own name in the sidebar, opens its worktree, marks a change reviewed there and shows what changes on it live', async ({
  pairedPage,
  app,
  server,
  remote,
}) => {
  const local = await server.project();
  const other = await remote.server.inventory();
  const otherProject = await remote.server.project();
  const otherMain = otherProject.worktrees.find((worktree) => worktree.main);
  const readme = remote.repo.readme.path;
  const rewritten = 'Rewritten on the other computer while it is open.';

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
        .getByRole('listitem', { name: other.environment.name, exact: true }),
    )
    .toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const here = pairedPage.getByRole('group', {
    name: 'This computer',
    exact: true,
  });
  const there = pairedPage.getByRole('group', {
    name: other.environment.name,
    exact: true,
  });
  await expect
    .element(there.getByText('Online', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      there.getByRole('button', { name: otherProject.name, exact: true }),
    )
    .toBeVisible();
  await expect
    .element(there.getByRole('button', { name: local.name, exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(here.getByRole('button', { name: local.name, exact: true }))
    .toBeVisible();
  await expect
    .element(here.getByRole('button', { name: otherProject.name, exact: true }))
    .not.toBeInTheDocument();
  await there.getByRole('button', { name: /Main worktree/ }).click();
  await expect
    .poll(() => app.address().path)
    .toBe(
      `/remotes/${other.environmentId}/${otherProject.id}/${otherMain?.id ?? ''}`,
    );
  await expect.poll(() => app.title()).toContain(other.environment.name);

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
      (await remote.server.reviewedFiles()).marks.map((entry) => entry.path),
    )
    .toContain(readme);
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);

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
  await expect
    .poll(async () => (await remote.server.liveTicketHits()).length)
    .toBeGreaterThan(0);
  await remote.repo.write(readme, `# Sample repository\n\n${rewritten}\n`);
  await expect
    .poll(async () => (await remote.server.text(readme)).text)
    .toContain(rewritten);
  await expect
    .element(pairedPage.getByText(rewritten, { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(readme)).text)
    .not.toContain(rewritten);
}, 30_000);

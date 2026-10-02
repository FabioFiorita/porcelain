import { expect, test } from './fixtures.ts';

test('the desktop app opens another computer’s worktree and HTML review, marks a change reviewed there and shows what changes on it live', async ({
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
  await expect(
    settings
      .getByRole('list', { name: 'Remote computers', exact: true })
      .getByRole('listitem', { name: other.environment.name, exact: true }),
  ).toBeVisible();
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
  await expect(there.getByText('Online', { exact: true })).toBeVisible();
  await expect(
    there.getByRole('button', { name: otherProject.name, exact: true }),
  ).toBeVisible();
  await expect(
    there.getByRole('button', { name: local.name, exact: true }),
  ).not.toBeAttached();
  await expect(
    here.getByRole('button', { name: local.name, exact: true }),
  ).toBeVisible();
  await expect(
    here.getByRole('button', { name: otherProject.name, exact: true }),
  ).not.toBeAttached();
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
  await expect(mark).toBeVisible();
  await mark.click();
  await expect(
    pairedPage.getByRole('button', {
      name: `Unmark ${readme} as unreviewed`,
      exact: true,
    }),
  ).toBeEnabled();
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
  await expect(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  const source = pairedPage.getByRole('tab', { name: 'Source', exact: true });
  await source.click();
  await expect(source).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(async () => (await remote.server.liveTicketHits()).length)
    .toBeGreaterThan(0);
  await remote.repo.write(readme, `# Sample repository\n\n${rewritten}\n`);
  await expect
    .poll(async () => (await remote.server.text(readme)).text)
    .toContain(rewritten);
  await expect(pairedPage.getByText(rewritten, { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await server.text(readme)).text)
    .not.toContain(rewritten);

  const layer = 'Remote review layer';
  await remote.agent.publishReview(
    layer,
    'changed',
    '<html><body><h1>Remote summary</h1><a href="#layer-1">Open remote layer</a></body></html>',
  );
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Review', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: 'Review summary', exact: true })
    .click();
  await app
    .summary()
    .getByRole('link', { name: 'Open remote layer', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('region', {
      name: `Review layer ${layer}`,
      exact: true,
    }),
  ).toBeVisible();
});

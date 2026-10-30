import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';
import { desktopSummaryHost } from '../kit/desktop-summaries.ts';

test('the desktop app opens another computer’s worktree and HTML review, marks a change reviewed there and shows what changes on it live', async ({
  pairedPage,
  app,
  server,
  remote,
}) => {
  await desktopSummaryHost(pairedPage);
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
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Computers', exact: true })
      .getByRole('listitem', { name: other.environment.name, exact: true }),
  ).toBeVisible();
  await settings
    .getByRole('button', { name: 'Close Settings', exact: true })
    .click();

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();

  await expect(
    pairedPage.getByRole('button', { name: new RegExp(`, ${local.name},`) }),
  ).toBeVisible();
  await pairedPage
    .getByRole('button', {
      name: new RegExp(`, ${otherProject.name}, ${other.environment.name},`),
    })
    .click();
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
  await pairedPage
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  await pairedPage
    .getByRole('region', { name: 'Readiness', exact: true })
    .getByRole('button', { name: 'No checks attached', exact: true })
    .click();
  await pairedPage
    .getByRole('tab', { name: 'Agent summary', exact: true })
    .click();
  await app
    .summary()
    .getByRole('link', { name: 'Open remote layer', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('region', {
      name: `1. ${layer}`,
      exact: true,
    }),
  ).toBeVisible();
});

test('PR actions on two computers keep the same PR number scoped to its review without switching the selected checkout', async ({
  pairedPage: page,
  app,
  server,
  remote,
}) => {
  const localProject = await server.project();
  const remoteProject = await remote.server.project();
  const localMain = localProject.worktrees.find((row) => row.main)?.path;
  const remoteMain = remoteProject.worktrees.find((row) => row.main)?.path;
  if (!localMain || !remoteMain)
    throw new Error('Missing fixture main checkout');
  const localFixture = await archiveFixture(localMain);
  const remoteFixture = await archiveFixture(remoteMain, { codeComment: true });
  localFixture.pullRequestUnavailable(true);
  try {
    await page.setViewportSize({ width: 1440, height: 896 });
    await app.reload();
    const original = app.address().path;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('main', { name: 'Settings', exact: true });
    await settings
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    await settings
      .getByRole('textbox', { name: 'Pairing link', exact: true })
      .fill(await app.remoteLink());
    await settings.getByRole('button', { name: 'Add', exact: true }).click();
    const remoteName = (await remote.server.inventory()).environment.name;
    const localName = (await server.inventory()).environment.name;
    await expect(
      settings.getByRole('listitem', { name: remoteName, exact: true }),
    ).toBeVisible();
    await settings
      .getByRole('button', { name: 'Close Settings', exact: true })
      .click();
    const sidebar = page.getByRole('navigation', {
      name: 'Projects and worktrees',
      exact: true,
    });
    await sidebar
      .getByRole('button', {
        name: `Open PR #423 · ${localProject.name} · ${localName}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Pull request unavailable',
        exact: true,
      }),
    ).toBeVisible();
    await sidebar
      .getByRole('button', {
        name: `Open PR #423 · ${remoteProject.name} · ${remoteName}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('article', { name: 'Pull request #423', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'PR #423', exact: true }),
    ).toHaveCount(2);
    await expect.poll(() => app.address().path).toBe(original);
    await expect(
      sidebar.getByRole('button', { name: /Main worktree.*Current$/ }),
    ).toHaveCount(1);
    await page
      .getByRole('tab', { name: 'PR #423', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Pull request unavailable',
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => app.address().path).toBe(original);
    await page
      .getByRole('tab', { name: 'PR #423', exact: true })
      .last()
      .click();
    await page
      .getByRole('button', { name: 'Open archive.txt:1', exact: true })
      .click();
    await expect
      .poll(() => app.address().path)
      .toBe(`/reviews/${remoteFixture.reviewId}`);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('environment'))
      .toBe((await remote.server.inventory()).environmentId);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('entry'))
      .toBe('file:archive.txt');
    await expect(
      page.getByText('A completed change.', { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole('article', { name: 'Pull request #423', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Back to the review', exact: true })
      .click();
    await expect
      .poll(() => app.address().path)
      .toBe(`/reviews/${remoteFixture.reviewId}`);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('environment'))
      .toBe((await remote.server.inventory()).environmentId);
  } finally {
    localFixture.pullRequestUnavailable(false);
  }
});

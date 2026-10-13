import { expect, test } from './fixtures.ts';

test('the web the server serves opens Settings on Updates, lists Updates, Git and agents, Appearance and Connection with no sharing sections, and the navigator still names this computer', async ({
  pairedPage,
  server,
}) => {
  const host = (await server.inventory()).environment.name;
  const offered = await server.serviceUpdate();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(navigator.getByText(host, { exact: true })).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  const sections = settings.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(sections.getByRole('button')).toHaveText([
    'Updates',
    'Git and agents',
    'Appearance',
    'Connection',
    'Back',
  ]);
  await expect(
    settings.getByRole('heading', { name: 'Updates', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${offered.version ?? ''}`, { exact: true }),
  ).toBeVisible();
});

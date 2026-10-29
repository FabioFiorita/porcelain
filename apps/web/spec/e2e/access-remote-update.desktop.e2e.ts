import { expect, test } from './fixtures.ts';

test('Computers shows each remote computer’s update on its detail page, tells an untrusted app how to get trusted there, and lets a trusted app start the update on that computer', async ({
  pairedPage,
  app,
  remote,
}) => {
  const other = (await remote.server.inventory()).environment.name;
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
  const add = async (link: string) => {
    await settings
      .getByRole('navigation', { name: 'Settings sections', exact: true })
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    await settings
      .getByRole('textbox', { name: 'Pairing link', exact: true })
      .fill(link);
    await settings.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(
      settings
        .getByRole('list', { name: 'Computers', exact: true })
        .getByRole('listitem', { name: other, exact: true }),
    ).toBeVisible();
    const row = settings.getByRole('listitem', { name: other, exact: true });
    await expect(row.getByRole('button', { name: /^Open / })).toBeVisible();
    await row.getByRole('button', { name: /^Open / }).click();
  };

  await add(await app.remoteLink());
  await expect(
    settings.getByText('Needs trust', { exact: true }),
  ).toBeVisible();
  await settings
    .getByRole('button', { name: 'Needs trust', exact: true })
    .click();
  const device = (await remote.server.devices()).find(
    (entry) => entry.label === 'Remote computer',
  );
  if (!device) throw new Error('The remote computer paired no device');
  await expect(
    settings.getByText(
      `Run porcelain trust ${device.id} on that computer, or allow it in the Mac app → Computers → This computer → Devices`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', { name: 'Copy device ID', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', { name: `Update ${other}`, exact: true }),
  ).not.toBeAttached();

  await add(await app.remoteLink('remote', { trusted: true }));
  await settings
    .getByRole('button', { name: `Update ${other}`, exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await remote.server.serviceUpdate();
      return state.running || state.last !== undefined;
    })
    .toBe(true);
});

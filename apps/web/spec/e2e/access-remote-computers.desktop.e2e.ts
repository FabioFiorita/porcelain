import { expect, test } from './fixtures.ts';

test('the desktop app adds a remote computer from the link porcelain pair prints, shows it online, refuses a used or broken link, shows needs pairing after revocation, and forgets it', async ({
  pairedPage,
  app,
  remote,
}) => {
  const host = (await remote.server.inventory()).environment.name;
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
  const empty = settings.getByText('No remote computers yet', { exact: true });
  await expect(empty).toBeVisible();

  const field = settings.getByRole('textbox', {
    name: 'Pairing link',
    exact: true,
  });
  const add = settings.getByRole('button', { name: 'Add', exact: true });
  await field.fill('not a link');
  await add.click();
  await expect(
    settings.getByText(
      'Paste the whole link porcelain pair printed, starting with http.',
      { exact: true },
    ),
  ).toBeVisible();

  await field.fill(await app.remoteLink('this'));
  await add.click();
  await expect(
    settings.getByText('That link is for this computer.', { exact: true }),
  ).toBeVisible();

  const link = await app.remoteLink();
  await field.fill(link);
  await add.click();
  const remotes = settings.getByRole('list', {
    name: 'Remote computers',
    exact: true,
  });
  const listed = remotes.getByRole('listitem', { name: host, exact: true });
  await expect(listed).toBeVisible();
  await expect(listed.getByText('Online', { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      (await remote.server.devices()).map((device) => device.label),
    )
    .toContain('Remote computer');

  await field.fill(link);
  await add.click();
  await expect(
    settings.getByText(
      'That link was not accepted. It works once, for a few minutes; run porcelain pair again.',
      { exact: true },
    ),
  ).toBeVisible();

  const device = (await remote.server.devices()).find(
    (entry) => entry.label === 'Remote computer',
  );
  if (device === undefined) throw new Error('The remote paired no device');
  await expect(app.revokeDevice(device.id)).resolves.toEqual({
    revoked: true,
    kind: 'device',
  });
  await app.reload();
  await expect(
    listed.getByText('Needs pairing', { exact: true }),
  ).toBeVisible();

  await listed
    .getByRole('button', { name: `Remove ${host}`, exact: true })
    .click();
  await expect(empty).toBeVisible();
});

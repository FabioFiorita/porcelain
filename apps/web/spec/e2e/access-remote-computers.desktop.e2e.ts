import { closeSettings } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('the desktop app adds a remote computer from the link porcelain pair prints, shows it online, refuses a used or broken link, shows needs pairing after revocation, and forgets it from its detail page', async ({
  pairedPage,
  app,
  remote,
}) => {
  const inventory = await remote.server.inventory();
  const host = inventory.environment.name;
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
  const empty = settings
    .getByRole('list', { name: 'Computers', exact: true })
    .getByRole('listitem');
  await expect(empty).toHaveCount(1);

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
    name: 'Computers',
    exact: true,
  });
  const listed = remotes.getByRole('listitem', { name: host, exact: true });
  await expect(listed).toBeVisible();
  await expect(listed).toContainText('Online');
  await expect(listed.getByRole('button', { name: /^Open / })).toBeVisible();
  await listed.getByRole('button', { name: /^Open / }).click();
  await expect(pairedPage).toHaveURL(
    new RegExp(`/settings/computers/${inventory.environmentId}$`),
  );
  await expect(settings.getByText('Online', { exact: true })).toBeVisible();
  await closeSettings(settings.page());
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
  await listed.getByRole('button', { name: /^Open / }).click();
  await expect(
    settings.getByText('Needs pairing', { exact: true }),
  ).toBeVisible();

  await settings
    .getByRole('button', { name: 'Forget on this app', exact: true })
    .click();
  await expect(empty).toHaveCount(1);
  await expect(pairedPage).toHaveURL(/\/settings\/computers$/);
});

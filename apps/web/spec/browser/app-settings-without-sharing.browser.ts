import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the web the server serves opens Settings with its preferences and Updates and no Sharing, and the navigator still names this computer', async ({
  pairedPage,
  server,
}) => {
  const host = (await server.inventory()).environment.name;
  const offered = await server.serviceUpdate();
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  await expect
    .element(navigator.getByText(host, { exact: true }))
    .toBeVisible();

  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  await expect
    .element(settings.getByText('Preferences stay in this browser.'))
    .toBeVisible();
  await expect
    .element(settings.getByRole('heading', { name: 'Appearance' }))
    .toBeVisible();
  await expect
    .element(settings.getByRole('heading', { name: 'Updates' }))
    .toBeVisible();
  await expect
    .element(settings.getByText(`Porcelain ${offered.version ?? ''}`))
    .toBeVisible();
  await expect
    .element(settings.getByRole('heading', { name: 'Connection' }))
    .toBeVisible();
  await expect
    .element(settings.getByRole('heading', { name: 'Sharing' }))
    .not.toBeInTheDocument();
  await expect.element(settings.getByText(/Sharing/)).not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('textbox', { name: 'Name of this computer' }))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('switch', { name: 'Local network' }))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('button', { name: 'Create pairing link' }))
    .not.toBeInTheDocument();
});

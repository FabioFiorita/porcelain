import { expect } from 'vitest';
import { test } from '../kit/journey';

test('Settings says which choices stay in this app and which change Porcelain for every device', async ({
  pairedPage,
}) => {
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  await expect
    .element(
      settings.getByText(
        'Preferences stay in this app. Sharing changes Porcelain for every device.',
      ),
    )
    .toBeVisible();
  await expect
    .element(settings.getByRole('heading', { name: 'Updates' }))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('heading', { name: 'Connection' }))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByText('Stored on this device.'))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('heading', { name: 'Sharing' }))
    .toBeVisible();
});

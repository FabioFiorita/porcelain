import { expect } from 'vitest';
import { test } from '../kit/journey';

test('desktop Settings shows Sharing and does not say preferences are stored on this device', async ({
  pairedPage,
}) => {
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  await expect
    .element(settings.getByText(/Preferences stay in this browser/))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByText('Stored on this device.'))
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('heading', { name: 'Sharing' }))
    .toBeVisible();
});

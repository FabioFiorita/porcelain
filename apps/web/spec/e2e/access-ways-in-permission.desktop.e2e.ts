import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('on This computer the owner lets a paired device edit ways in, sees which device can, and takes it back without touching update trust', async ({
  pairedPage,
  server,
}) => {
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
  await openThisComputer(pairedPage);

  const stored = async (label: string) => {
    const device = (await server.devices()).find(
      (entry) => entry.label === label,
    );
    return [device?.canEditWaysIn, device?.trusted];
  };
  const waysIn = settings.getByRole('switch', {
    name: 'Development setup can edit ways in',
    exact: true,
  });
  const update = settings.getByRole('switch', {
    name: 'Development setup can update Porcelain',
    exact: true,
  });
  await expect(waysIn).not.toBeChecked();
  await expect(update).not.toBeChecked();

  await waysIn.click();
  await expect(waysIn).toBeChecked();
  await expect(update).not.toBeChecked();
  await expect.poll(() => stored('Development setup')).toEqual([true, false]);

  await pairedPage.reload();
  await expect(waysIn).toBeChecked();

  await waysIn.click();
  await expect(waysIn).not.toBeChecked();
  await expect.poll(() => stored('Development setup')).toEqual([false, false]);
});

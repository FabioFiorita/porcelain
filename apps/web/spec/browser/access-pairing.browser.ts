import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a one-time link pairs the browser and opens the workspace without leaving its code in the address', async ({
  pairedPage,
  app,
  server,
}) => {
  await expect
    .element(pairedPage.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  await expect.poll(() => app.address().fragment).toBe('');
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
});

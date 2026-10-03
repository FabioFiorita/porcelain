import { expect, test } from './fixtures.ts';

test('a one-time link pairs the browser and opens the workspace without leaving its code in the address', async ({
  pairedPage,
  app,
  server,
}) => {
  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  await expect.poll(() => app.address().fragment).toBe('');
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
});

test('a paired browser that opens the pairing page goes to its workspace instead of being told it is not paired', async ({
  pairedPage,
  app,
}) => {
  await app.open('/pair');

  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect.poll(() => app.address().path).not.toBe('/pair');
});

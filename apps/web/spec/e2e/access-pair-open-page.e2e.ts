import { expect, test } from './fixtures.ts';

test('a link entered in a tab already showing the not-paired page pairs the browser', async ({
  unpairedPage,
  app,
  server,
}) => {
  await expect(
    unpairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => app.address().path).toBe('/pair');

  await app.follow(await app.link('this'));
  await expect(
    unpairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  await expect.poll(() => app.address().fragment).toBe('');
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
});

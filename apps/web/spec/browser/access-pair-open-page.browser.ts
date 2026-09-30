import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a link entered in a tab already showing the not-paired page pairs the browser', async ({
  unpairedPage,
  app,
  server,
}) => {
  await expect
    .element(
      unpairedPage.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.poll(() => app.address().path).toBe('/pair');

  app.follow(await app.link('this'));
  await expect
    .element(
      unpairedPage.getByRole('region', { name: 'Review content', exact: true }),
    )
    .toBeVisible();
  await expect.poll(() => app.address().fragment).toBe('');
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
});

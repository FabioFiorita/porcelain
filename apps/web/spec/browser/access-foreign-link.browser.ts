import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a link made for another installation is refused and pairs no device', async ({
  app,
  server,
}) => {
  const page = await app.open(await app.link('another'));
  await expect
    .element(
      page.getByText(
        'This link was made for a different Porcelain installation.',
      ),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole('heading', { name: 'This browser is not paired' }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .not.toContain('Journey browser');
});

import { expect, test } from './fixtures.ts';

test('a link made for another installation is refused and pairs no device', async ({
  app,
  server,
}) => {
  const page = await app.open(await app.link('another'));
  await expect(
    page.getByText(
      'This link was made for a different Porcelain installation.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .not.toContain('Journey browser');
});

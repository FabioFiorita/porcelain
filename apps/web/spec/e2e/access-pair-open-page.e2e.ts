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

test('a durable latest decision link returns through pairing and keeps its destination after reload', async ({
  unpairedPage,
  app,
  repo,
}) => {
  const title = 'Open the committed decision from a durable link';
  const review = await repo.review(title);
  await app.open(`/reviews/${review.reviewId}?decision=${review.layerId}`);
  await expect(
    unpairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await app.follow(await app.link('this'));
  await expect
    .poll(() => app.address().path)
    .toBe(`/reviews/${review.reviewId}`);
  await expect
    .poll(() => app.address().query)
    .toBe(`?decision=${review.layerId}`);
  await expect(
    unpairedPage.getByRole('region', { name: `1. ${title}`, exact: true }),
  ).toBeVisible();
  await app.reload();
  await expect(
    unpairedPage.getByRole('region', { name: `1. ${title}`, exact: true }),
  ).toBeVisible();
  await expect.poll(() => app.address().fragment).toBe('');
});

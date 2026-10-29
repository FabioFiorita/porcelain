import { expect, test } from './fixtures.ts';

test('an Agent summary opened after its signed link expired loads through a fresh link', async ({
  pairedPage: page,
  app,
  agent,
  world,
}) => {
  await agent.publishReview(
    'Expiring summary',
    'changed',
    '<!doctype html><h1>Extra context</h1>',
  );
  await app.reload();
  await expect(
    page.getByRole('tablist', { name: 'Review presentation', exact: true }),
  ).toHaveAttribute('aria-busy', 'false');
  await world.server.advanceTime(60_000);
  await page.getByRole('tab', { name: 'Agent summary', exact: true }).click();
  await expect(
    app.summary().getByRole('heading', { name: 'Extra context', exact: true }),
  ).toBeVisible();
});

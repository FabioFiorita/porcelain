import { expect, test } from './fixtures.ts';

test('retrying a refused review read restores the workspace at the same address', async ({
  pairedPage,
  app,
  failures,
}) => {
  failures.console(/RequestError: Request failed \(503\)/);
  const address = app.address().path;
  const endOutage = await app.failReviewRead();
  await app.reload();
  const retry = pairedPage.getByRole('button', {
    name: 'Try again',
    exact: true,
  });
  await expect(retry).toBeVisible();
  await expect.poll(() => app.address().path).toBe(address);
  await endOutage();
  await retry.click();
  await expect(
    pairedPage.getByRole('heading', { name: 'Changes', exact: true }),
  ).toBeVisible();
  await expect(pairedPage.getByRole('code')).toContainText(
    'A change to review.',
  );
  await expect(retry).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(address);
});

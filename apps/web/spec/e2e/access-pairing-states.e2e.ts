import { expect, test } from './fixtures.ts';

test('first run explains the three-step pairing route and its expiry', async ({
  unpairedPage: page,
}) => {
  await expect(
    page.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'How pairing works', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'How pairing works', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(3);
  await expect(
    page.getByText('It prints a link that works once, for 15 minutes.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Install guide', exact: true }),
  ).toHaveAttribute('href', 'https://porcelain.fabiofiorita.com/install');
  await expect(
    page.getByRole('button', { name: 'Copy the command', exact: true }),
  ).toBeVisible();
});

for (const invalid of [
  'missing-code',
  'foreign',
  'revoked',
  'expired',
] as const) {
  test(`a ${invalid} pairing link keeps the route and recovers through a fresh link`, async ({
    page,
    app,
    server,
    world,
  }) => {
    let address = '/pair#missing-code';
    let reason = 'That link carried no pairing code.';
    if (invalid === 'foreign') {
      address = await app.link('another');
      reason = 'This link was made for a different Porcelain installation.';
    }
    if (invalid === 'revoked' || invalid === 'expired') {
      address = await app.link('this');
      reason = 'This pairing link is not usable. Ask for a new one.';
      if (invalid === 'expired') await world.server.advanceTime(15 * 60 * 1000);
      else {
        const [grant] = await server.pendingLinks();
        if (!grant) throw new Error('The pairing grant was not registered.');
        await app.revokeDevice(grant.id, 'this');
      }
    }
    await app.open(address);
    await expect(
      page.getByRole('list', { name: 'How pairing works', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(reason);
    await expect(
      page.getByRole('heading', {
        name: 'On your computer, run it again',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Copy the command', exact: true }),
    ).toBeVisible();
    await expect.poll(() => app.address().fragment).toBe('');
    await app.open(await app.link('this'));
    await expect(
      page.getByRole('region', { name: 'Review content', exact: true }),
    ).toBeVisible();
  });
}

test('checking a pairing link keeps the page and advances the route', async ({
  page,
  app,
  fetchGate,
}) => {
  const held = await fetchGate.holdNextPost('/pair');
  held.arm();
  const opened = app.open(await app.link('this'));
  try {
    await held.requested;
    await expect(
      page.getByRole('status').filter({
        hasText: 'Checking the link with your computer',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'How pairing works', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Step 2, current', { exact: true }),
    ).toHaveAttribute('aria-current', 'step');
  } finally {
    held.release();
  }
  await opened;
  await expect(
    page.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
});

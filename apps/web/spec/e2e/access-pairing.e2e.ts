import { expect, observeBrowserFailures, test } from './fixtures.ts';

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

test('reopening a used link restores the paired browser across reloads without pairing another device', async ({
  page,
  app,
  server,
}) => {
  const link = await app.link('this');
  await app.open(link);
  const workspace = page.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect(workspace).toBeVisible();
  const devices = await server.devices();

  for (const reopen of [true, false, true]) {
    if (reopen) await app.open(link);
    else await app.reload();
    await expect(workspace).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    ).not.toBeAttached();
    await expect.poll(() => app.address().path).not.toBe('/pair');
    await expect.poll(() => app.address().fragment).toBe('');
  }
  await expect
    .poll(async () => (await server.devices()).map((device) => device.id))
    .toEqual(devices.map((device) => device.id));
});

test('a clean unpaired browser cannot reuse a used link and can return through a fresh link', async ({
  page,
  browser,
  observed,
  app,
  server,
}) => {
  const link = await app.link('this');
  const pairedContext = await browser.newContext();
  observeBrowserFailures(pairedContext, observed);
  try {
    const pairedPage = await pairedContext.newPage();
    await pairedPage.goto(link);
    await expect(
      pairedPage.getByRole('region', { name: 'Review content', exact: true }),
    ).toBeVisible();
  } finally {
    await pairedContext.close();
  }
  const devices = await server.devices();
  await app.open(link);
  await expect(
    page.getByText('This pairing link is not usable. Ask for a new one.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.id))
    .toEqual(devices.map((device) => device.id));
  await app.reload();
  await expect(
    page.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await app.open(await app.link('this'));
  await expect(
    page.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
});

test('a revoked browser session cannot regain access through its used link', async ({
  page,
  app,
  server,
}) => {
  const link = await app.link('this');
  await app.open(link);
  await expect(
    page.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  const browser = (await server.devices()).find(
    (device) => device.label === 'Journey browser',
  );
  if (!browser) throw new Error('The paired browser was not registered.');
  await app.revokeDevice(browser.id, 'this');
  await app.open(link);
  await expect(
    page.getByText('This pairing link is not usable. Ask for a new one.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Review content', exact: true }),
  ).not.toBeAttached();
});

for (const invalid of ['revoked', 'expired'] as const) {
  test(`an unpaired browser cannot use a link that is ${invalid}`, async ({
    page,
    app,
    server,
    world,
  }) => {
    const link = await app.link('this');
    if (invalid === 'revoked') {
      const [grant] = await server.pendingLinks();
      if (!grant) throw new Error('The pairing link was not registered.');
      await app.revokeDevice(grant.id, 'this');
    } else {
      await world.server.advanceTime(15 * 60 * 1000);
    }
    const devices = await server.devices();
    await app.open(link);
    await expect(
      page.getByText('This pairing link is not usable. Ask for a new one.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(async () => (await server.devices()).map((device) => device.id))
      .toEqual(devices.map((device) => device.id));
  });
}

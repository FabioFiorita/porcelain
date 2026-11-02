import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { appRequest, expect, test } from './fixtures.ts';

const reviewId = '10000000-0000-4000-8000-000000000001';
const environment = '20000000-0000-4000-8000-000000000002';
const decision = '30000000-0000-4000-8000-000000000003';
const link = `porcelain-desktop://open/reviews/${reviewId}?environment=${environment}&host=computer.example.com&protocol=https&revision=3&decision=${decision}`;

test('a cold review link waits for the renderer and retains the remote destination for pairing', async ({
  desktop,
}) => {
  const app = await desktop.launch(undefined, [link]);
  const page = await app.window();
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?environment=${environment}&decision=${decision}`,
  );
  await page
    .getByRole('button', { name: 'Back to workspace', exact: true })
    .click();
  await expect(page).toHaveURL('porcelain://app/');
  expect(app.errors).toEqual([]);
});

test('a Mac open-url event uses this computer when the environment matches and rejects unsafe links', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await appRequest(page, 'GET', '/api/inventory'),
  );
  const local = `porcelain-desktop://open/reviews/${reviewId}?environment=${inventory.environmentId}&host=localhost&revision=3&decision=${decision}`;
  await app.electron.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, url);
  }, local);
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?decision=${decision}`,
  );
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeHidden();
  await app.electron.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, `${url}&host=evil.com`);
    app.emit(
      'open-url',
      { preventDefault() {} },
      'porcelain-desktop://app/settings',
    );
  }, local);
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?decision=${decision}`,
  );
  expect(app.errors).toEqual([]);
});

test('a real second process delivers its review URL to the existing window', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeVisible();
  expect(await desktop.launchSecondInstance(link)).toBe(0);
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?environment=${environment}&decision=${decision}`,
  );
  expect(
    await app.electron.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  expect(app.errors).toEqual([]);
});

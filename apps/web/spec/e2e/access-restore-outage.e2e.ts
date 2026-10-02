import { expect, test } from './fixtures.ts';

test('a reload while the server cannot answer keeps the address and shows the workspace again when the connection returns', async ({
  app,
  failures,
}) => {
  failures.console(/Could not reach Porcelain to restore this browser session/);
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(
    opened.getByRole('tab', { name: 'Files', selected: true, exact: true }),
  ).toBeVisible();
  const workspace = app.address().path;
  const outage = await app.failSessionRestore();

  await app.reload();

  await expect(
    opened.getByText('Could not display the workspace.', { exact: true }),
  ).toBeVisible();
  await expect(
    opened.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(workspace);

  await outage.end();

  await expect(
    opened.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  await expect.poll(() => app.address().path).toBe(workspace);
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(
    opened.getByRole('tab', { name: 'Files', selected: true, exact: true }),
  ).toBeVisible();
});

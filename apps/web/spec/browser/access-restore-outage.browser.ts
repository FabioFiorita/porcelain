import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a reload while the server cannot answer keeps the address and shows the workspace again when the connection returns', async ({
  app,
  failures,
}) => {
  failures.console(/Could not reach Porcelain to restore this browser session/);
  const opened = await app.openReloadable(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  await expect
    .element(opened.getByRole('tab', { name: 'Files', selected: true }))
    .toBeVisible();
  const workspace = app.address().path;
  const outage = await app.failSessionRestore();

  await app.reload();

  await expect
    .element(opened.getByText('Could not display the workspace.'))
    .toBeVisible();
  await expect
    .element(
      opened.getByRole('heading', { name: 'This browser is not paired' }),
    )
    .not.toBeInTheDocument();
  await expect.poll(() => app.address().path).toBe(workspace);

  outage.end();

  await expect
    .element(opened.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  await expect.poll(() => app.address().path).toBe(workspace);
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await expect
    .element(opened.getByRole('tab', { name: 'Files', selected: true }))
    .toBeVisible();
});

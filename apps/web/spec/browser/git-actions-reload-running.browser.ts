import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a commit still running when the page reloads is still followed: the commit form waits for its outcome, then shows it ended interrupted', async ({
  app,
  repo,
  server,
}) => {
  await repo.remove('.git/logs/HEAD');
  await repo.fifo('.git/logs/HEAD');
  const opened = await app.openReloadable(await app.link('this'));
  const commit = opened.getByRole('button', { name: 'Commit', exact: true });
  await commit.click();
  const dialog = opened.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Commit across a reload');
  const live = app.holdLive();
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('button', { name: 'Committing…', exact: true }))
    .toBeDisabled();
  await expect
    .element(dialog.getByText('running', { exact: true }))
    .toBeVisible();

  await app.reload();

  await commit.click();
  await expect
    .element(dialog.getByText('Outcome not yet confirmed', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      dialog.getByRole('button', {
        name: 'Commit selected files',
        exact: true,
      }),
    )
    .toBeDisabled();

  live.release();
  await expect
    .element(dialog.getByText('interrupted', { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByText('Outcome not yet confirmed', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.changes()).interrupted?.action)
    .toBe('commit');
});

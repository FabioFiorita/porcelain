import { expect, test } from './fixtures.tsx';

test('reopening configured preferences retains values without checking update permissions again', async ({
  render,
  server,
  fetchGate,
}) => {
  const held = fetchGate.holdNextReviewGitSettings();
  const page = await render.preferences();
  await page
    .getByRole('button', {
      name: 'Use these settings for this computer',
      exact: true,
    })
    .click();
  const specs = page.getByRole('switch', { name: 'Spec files', exact: true });
  await expect.element(specs).toBeEnabled();
  await page.getByRole('tab', { name: 'Rebase', exact: true }).click();
  await expect
    .poll(() => server.reviewGitSettings())
    .toMatchObject({
      kind: 'configured',
      settings: { pullStrategy: 'rebase' },
    });
  await page
    .getByRole('button', { name: 'Hide preferences', exact: true })
    .click();
  await expect.element(specs).not.toBeInTheDocument();
  const checks = await server.serviceUpdateReads();
  held.arm();
  try {
    await page
      .getByRole('button', { name: 'Show preferences', exact: true })
      .click();
    await held.requested;
    await expect
      .element(page.getByRole('tab', { name: 'Rebase', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => server.serviceUpdateReads()).toBe(checks);
    held.release();
    await held.finished;
    await expect.element(specs).toBeEnabled();
    await expect.poll(() => server.serviceUpdateReads()).toBe(checks);
  } finally {
    held.release();
  }
});

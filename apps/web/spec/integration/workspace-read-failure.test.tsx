import { expect, test } from './fixtures.tsx';

test('a worktree whose changes cannot be read keeps its tabs and toolbar, and Try again recovers', async ({
  render,
  fetchGate,
  failures,
}) => {
  failures.console(/Request failed \(413\)/);
  const recover = fetchGate.failChangeReads();
  const page = await render.workspace();

  await expect
    .element(page.getByText(/could not be loaded/).first())
    .toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Review', exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Toggle Sidebar', exact: true }))
    .toBeVisible();

  recover();
  await page
    .getByRole('button', { name: 'Try again', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText(/could not be loaded/))
    .not.toBeInTheDocument();
});

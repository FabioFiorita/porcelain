import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('returning to a file tab restores its reading position without marking it reviewed', async ({
  repo,
  render,
  reviewLayout,
  server,
}) => {
  const path = 'long.txt';
  await repo.write(
    path,
    Array.from({ length: 400 }, (_, index) => `reading line ${index + 1}`).join(
      '\n',
    ),
  );
  const app = await render.route('/');
  await app.navigate(`${app.location().split('?')[0]}?entry=file:${path}`);
  const code = app.page.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  await expect
    .element(app.page.getByText('reading line 1', { exact: true }))
    .toBeVisible();
  const controls = app.page.getByRole('toolbar', {
    name: 'Document controls',
    exact: true,
  });
  await expect
    .element(controls.getByRole('button', { name: 'Reviewed', exact: true }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('r');
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);
  reviewLayout.scrollCodeTo(code, 1200);
  await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(1200);
  await app.page.getByRole('tab', { name: 'Changes', exact: true }).click();
  await app.page.getByRole('tab', { name: path, exact: true }).click();
  await expect
    .element(app.page.getByRole('heading', { name: path, exact: true }))
    .toBeVisible();
  await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(1200);
  await app.page
    .getByRole('button', { name: 'Open diff', exact: true })
    .click();
  const reviewed = controls.getByRole('button', {
    name: 'Reviewed',
    exact: true,
  });
  await expect.element(reviewed).toBeEnabled();
  await reviewed.click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual([path]);
});

test('reopening Files keeps its confirmed tree visible while folder reads refresh', async ({
  render,
  fetchGate,
  repo,
}) => {
  await page.viewport(1440, 900);
  const held = fetchGate.holdNextDirectoryRead();
  const app = await render.workspace();
  const rail = app.getByRole('navigation', { name: 'Side panel', exact: true });
  const files = rail.getByRole('button', { name: 'Files', exact: true });
  await files.click();
  const file = app.getByRole('treeitem', { name: 'README.md', exact: true });
  await expect.element(file).toBeVisible();
  await rail
    .getByRole('button', { name: 'Hide side panel', exact: true })
    .click();
  await expect.element(file).not.toBeInTheDocument();
  held.arm();
  try {
    await repo.write('fresh.txt', 'A refreshed directory entry');
    await files.click();
    await held.requested;
    await expect.element(file).toBeVisible();
    await expect
      .element(app.getByText('Loading review', { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByText('Loading files', { exact: true }))
      .not.toBeInTheDocument();
    await rail
      .getByRole('button', { name: 'Hide side panel', exact: true })
      .click();
    await expect.element(file).not.toBeInTheDocument();
    await files.click();
    await expect.element(file).toBeVisible();
    await expect
      .element(app.getByText('Loading review', { exact: true }))
      .not.toBeInTheDocument();
    held.release();
    await expect
      .element(app.getByRole('treeitem', { name: 'fresh.txt', exact: true }))
      .toBeVisible();
  } finally {
    held.release();
    await page.viewport(414, 896);
  }
});

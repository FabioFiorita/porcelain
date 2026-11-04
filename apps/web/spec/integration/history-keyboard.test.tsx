import { page, userEvent } from 'vitest/browser';
import { expect, test, expectInputFocus } from './fixtures.tsx';

test('History retains commit focus and arrows traverse commits without taking over tab shortcuts', async ({
  repo,
  render,
}) => {
  await page.viewport(1280, 896);
  try {
    await repo.commit('Newest commit');
    await repo.branch('newest-ref');
    const workspace = await render.workspace();
    await workspace
      .getByRole('navigation', { name: 'Side panel', exact: true })
      .getByRole('button', { name: 'History', exact: true })
      .click();
    const list = workspace.getByRole('list', { name: 'Commits', exact: true });
    const newest = list.getByRole('button', { name: /^Newest commit/ });
    const oldest = list.getByRole('button', { name: /^Initial commit/ });
    await newest.click();
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Newest commit', exact: true }),
      )
      .toBeVisible();
    await expectInputFocus(newest);
    await userEvent.keyboard('{ArrowDown}');
    await expectInputFocus(oldest);
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{ArrowDown}');
    await expectInputFocus(oldest);
    await userEvent.keyboard('{ArrowUp}');
    await expectInputFocus(newest);
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Newest commit', exact: true }),
      )
      .toBeVisible();
    await list.getByRole('button', { name: 'newest-ref', exact: true }).click();
    await userEvent.keyboard('{ArrowDown}');
    await expectInputFocus(oldest);
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{ArrowUp}');
    await expectInputFocus(newest);
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await expect
      .element(
        workspace.getByRole('heading', { name: 'Newest commit', exact: true }),
      )
      .toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

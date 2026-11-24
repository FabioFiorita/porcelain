import { userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test('opening a document tab’s context menu closes its tooltip', async ({
  render,
}) => {
  const app = await render.route('/');
  const tab = app.page
    .getByRole('tab', { name: 'Review', exact: true })
    .first();
  await tab.hover();
  await expect
    .element(app.page.getByRole('tooltip'))
    .toHaveTextContent("The branch's review");
  await tab.click({ button: 'right' });
  await expect
    .element(
      app.page.getByRole('menuitem', { name: 'Close others', exact: true }),
    )
    .toBeVisible();
  await expect.element(app.page.getByRole('tooltip')).not.toBeInTheDocument();

  await userEvent.keyboard('{Escape}');
  await expect
    .element(
      app.page.getByRole('menuitem', { name: 'Close others', exact: true }),
    )
    .not.toBeInTheDocument();
  await app.page.getByRole('button', { name: 'Commit', exact: true }).hover();
  await tab.hover();
  await expect
    .element(
      app.page.getByRole('tooltip').filter({ hasText: "The branch's review" }),
    )
    .toBeVisible();
});

test('a tooltip stays open while the pointer rests on it', async ({
  render,
}) => {
  const app = await render.route('/');
  await app.page
    .getByRole('tab', { name: 'Review', exact: true })
    .first()
    .hover();
  const tooltip = app.page
    .getByRole('tooltip')
    .filter({ hasText: "The branch's review" });
  await expect.element(tooltip).toBeVisible();
  await tooltip.hover();
  await expect.element(tooltip).toBeVisible();
  await app.page.getByRole('button', { name: 'Commit', exact: true }).hover();
  await expect.element(tooltip).not.toBeInTheDocument();
});

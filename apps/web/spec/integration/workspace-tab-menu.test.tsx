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

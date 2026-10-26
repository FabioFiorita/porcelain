import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([
  { renamed: 'a.md', clipped: false },
  {
    renamed:
      'a-very-long-renamed-document-with-a-complete-name-that-must-stay-readable-in-the-discarded-menu.md',
    clipped: true,
  },
])(
  'one Escape closes the discarded rename menu for $renamed and returns focus to Git actions',
  async ({ renamed, clipped }, { render, repo }) => {
    const original = 'original-document.md';
    await repo.write(original, 'A document to rename\n');
    await repo.commit('Add document');
    await repo.rename(original, renamed);
    const app = await render.route('/');
    await expect
      .element(app.page.getByRole('tab', { name: 'Changes', exact: true }))
      .toBeVisible();
    await app.navigate(
      `${app.location().split('?')[0]}?entry=change:${renamed}`,
    );
    await app.page
      .getByRole('button', {
        name: `Discard changes to ${renamed}`,
        exact: true,
      })
      .click();
    await app.page
      .getByRole('alertdialog', { name: `Discard ${renamed}?`, exact: true })
      .getByRole('button', { name: 'Discard', exact: true })
      .click();
    await expect.poll(() => repo.read(original)).toBe('A document to rename\n');
    const opener = app.page.getByRole('button', {
      name: 'Git actions',
      exact: true,
    });
    await opener.click();
    const menu = app.page.getByRole('menu');
    const label = `Restore discarded rename of ${renamed}`;
    const restore = menu.getByRole('menuitem', { name: label, exact: true });
    await expect.element(restore).toBeVisible();
    await expect.element(menu).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect.element(restore).toHaveFocus();
    const tooltip = app.page.getByRole('tooltip', { name: label, exact: true });
    if (clipped) await expect.element(tooltip).toBeVisible();
    else await expect.element(tooltip).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
    await opener.click();
    await restore.click();
    await expect.poll(() => repo.read(renamed)).toBe('A document to rename\n');
  },
);

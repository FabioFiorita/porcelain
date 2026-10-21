import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'a file is duplicated from its menu and the open copy again with Mod+D at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const project = (await server.project()).name;
      const path = 'notes.md';
      await repo.write(path, 'Notes to copy\n');
      const names = async () =>
        (await server.directory('')).entries.map((entry) => entry.name);

      const app = await render.route('/');
      const page = app.page;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Files', exact: true }).click();
      await page
        .getByRole('treeitem', { name: path, exact: true })
        .click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Duplicate', exact: true })
        .click();
      await expect.poll(names).toContain('notes copy.md');
      await expect
        .poll(async () => (await server.text('notes copy.md')).text)
        .toBe('Notes to copy\n');
      await expect
        .poll(async () => (await server.text(path)).text)
        .toBe('Notes to copy\n');
      await expect.poll(() => app.title()).toBe(`notes copy.md — ${project}`);

      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Files', exact: true }).click();
      await expect
        .element(
          page.getByRole('treeitem', { name: 'notes copy.md', exact: true }),
        )
        .toBeVisible();
      await userEvent.keyboard('{ControlOrMeta>}d{/ControlOrMeta}');
      await expect.poll(names).toContain('notes copy copy.md');
      await expect
        .poll(async () => (await server.text('notes copy copy.md')).text)
        .toBe('Notes to copy\n');
      await expect
        .poll(() => app.title())
        .toBe(`notes copy copy.md — ${project}`);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

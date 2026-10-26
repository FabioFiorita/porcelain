import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const binary = 'binary\u0000content\n';
const picture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n';

test.for([
  { path: 'data.bin', tracked: true, text: binary },
  { path: 'logo.svg', tracked: true, text: picture },
  { path: 'new.bin', tracked: false, text: binary },
  {
    path: 'a-very-long-binary-document-name-for-file-actions.bin',
    tracked: true,
    text: binary,
  },
])(
  'non-text $path keeps working file actions in its pane',
  async ({ path, tracked, text }, { render, repo, server }) => {
    if (tracked) {
      await repo.write('.gitattributes', '*.svg binary\n');
      await repo.write(path, text);
      await repo.commit('Add non-text file');
    }
    await repo.write(path, `${text}\n`);
    const app = await render.route('/');
    await expect
      .element(app.page.getByRole('tab', { name: 'Changes', exact: true }))
      .toBeVisible();
    await app.navigate(`${app.location().split('?')[0]}?entry=change:${path}`);
    const controls = app.page.getByRole('toolbar', {
      name: 'Document controls',
      exact: true,
    });
    const reviewed = controls.getByRole('button', {
      name: 'Reviewed',
      exact: true,
    });
    await expect.element(reviewed).toBeEnabled();
    await expect
      .element(controls.getByRole('button', { name: 'Comment', exact: true }))
      .toBeEnabled();
    await expect
      .element(controls.getByRole('button', { name: 'Timeline', exact: true }))
      .toBeVisible();
    await reviewed.click();
    await expect
      .poll(async () =>
        (await server.reviewedFiles()).marks.map((mark) => mark.path),
      )
      .toContain(path);
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('r');
    await expect
      .poll(async () =>
        (await server.reviewedFiles()).marks.map((mark) => mark.path),
      )
      .not.toContain(path);
    await userEvent.keyboard('c');
    await expect
      .element(app.page.getByRole('textbox', { name: 'Comment', exact: true }))
      .toBeVisible();
    await app.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await controls
      .getByRole('button', { name: 'Comment', exact: true })
      .click();
    const comment = app.page.getByRole('textbox', {
      name: 'Comment',
      exact: true,
    });
    await expect.element(comment).toBeVisible();
    await expect
      .element(
        app.page.getByRole('button', { name: 'Comment', exact: true }).nth(1),
      )
      .toBeDisabled();
    await app.page
      .getByRole('textbox', { name: 'Comment', exact: true })
      .fill('Explain this binary change');
    await app.page
      .getByRole('button', { name: 'Comment', exact: true })
      .nth(1)
      .click();
    await expect
      .poll(async () =>
        (await server.commentThreads()).map((thread) => ({
          path: thread.anchor.filePath,
          body: thread.messages[0]?.body,
        })),
      )
      .toContainEqual({ path, body: 'Explain this binary change' });
    await app.page
      .getByRole('button', { name: 'Open file', exact: true })
      .click();
    await expect
      .element(app.page.getByRole('tab', { name: path, exact: true }).nth(1))
      .toHaveAttribute('data-entry', `file:${path}`);
    await app.navigate(`${app.location().split('?')[0]}?entry=change:${path}`);
    await app.page
      .getByRole('button', {
        name: `Discard changes to ${path.split('/').at(-1)}`,
        exact: true,
      })
      .click();
    const dialog = app.page.getByRole('alertdialog', {
      name: `Discard ${path.split('/').at(-1)}?`,
      exact: true,
    });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => repo.read(path)).toBe(`${text}\n`);
    await app.page
      .getByRole('button', {
        name: `Discard changes to ${path.split('/').at(-1)}`,
        exact: true,
      })
      .click();
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect
      .element(app.page.getByText('Change no longer present', { exact: true }))
      .toBeVisible();
    await app.page
      .getByRole('button', { name: 'Restore', exact: true })
      .click();
    await expect.poll(() => repo.read(path)).toBe(`${text}\n`);
  },
);

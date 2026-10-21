import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'a comment on a branch file is saved against the branch and waits for the agent at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('notes.md', 'first line\nsecond line\n');
      await repo.commit('Add notes');
      const app = await render.route('/');
      const page = app.page;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await page.getByRole('tab', { name: 'Branch', exact: true }).click();
      await page
        .getByRole('button', { name: 'notes.md · added', exact: true })
        .click();
      await expect
        .element(page.getByText('second line', { exact: true }))
        .toBeVisible();
      const body = 'Why a second line?';
      const tip = (await server.branchChanges()).head.oid;
      await page
        .getByRole('button', {
          name: 'Comment on notes.md (added)',
          exact: true,
        })
        .click();
      await page
        .getByRole('textbox', { name: 'Comment', exact: true })
        .fill(body);
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await expect
        .element(page.getByText('Waiting for the agent', { exact: true }))
        .toBeVisible();
      await expect
        .poll(async () =>
          (await server.commentThreads()).map((thread) => ({
            anchor: thread.anchor,
            messages: thread.messages.map((message) => message.body),
          })),
        )
        .toMatchObject([
          {
            anchor: {
              kind: 'file',
              filePath: 'notes.md',
              comparison: { kind: 'branch', base: 'refs/heads/main' },
              revision: tip,
            },
            messages: [body],
          },
        ]);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([1280, 414])(
  'reviewing the branch lists the files committed since the default branch and opens the diff of one at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('notes.md', 'first line\nsecond line\n');
      await repo.commit('Add notes');
      await expect
        .poll(async () =>
          (await server.branchChanges()).files.map((file) => file.path),
        )
        .toEqual([repo.readme.path, 'notes.md']);

      const app = await render.route('/');
      const page = app.page;
      const search = () => new URL(app.location(), 'http://test').searchParams;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await page.getByRole('tab', { name: 'Branch', exact: true }).click();
      await expect
        .element(
          page.getByText('1 commit on feature since main', { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(
          page.getByRole('button', {
            name: 'README.md · modified',
            exact: true,
          }),
        )
        .toBeVisible();
      await page
        .getByRole('button', { name: 'notes.md · added', exact: true })
        .click();

      await expect
        .element(page.getByText('notes.md · on the branch', { exact: true }))
        .toBeVisible();
      await expect
        .element(page.getByText('second line', { exact: true }))
        .toBeVisible();

      await expect.poll(() => search().get('scope')).toBe('branch');
      await expect.poll(() => search().get('entry')).toBe('branch:notes.md');
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

import { expect } from 'vitest';
import { test } from '../kit/journey';

test('reviewing the branch lists the files committed since the default branch and opens the diff of one', async ({
  pairedPage,
  app,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.commit('Add notes');
  await expect
    .poll(async () =>
      (await server.branchChanges()).files.map((file) => file.path),
    )
    .toEqual([repo.readme.path, 'notes.md']);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  await expect
    .element(pairedPage.getByText('1 commit on feature since main'))
    .toBeVisible();
  await expect
    .element(pairedPage.getByRole('button', { name: 'README.md · modified' }))
    .toBeVisible();
  await pairedPage.getByRole('button', { name: 'notes.md · added' }).click();

  await expect
    .element(pairedPage.getByText('notes.md · on the branch'))
    .toBeVisible();
  await expect.element(pairedPage.getByText('second line')).toBeVisible();
  const search = () => new URLSearchParams(app.address().query);
  await expect.poll(() => search().get('scope')).toBe('branch');
  await expect.poll(() => search().get('entry')).toBe('branch:notes.md');
});

test('marking a branch file reviewed keeps the mark in the branch review only', async ({
  pairedPage,
  server,
}) => {
  const branchMarks = async () =>
    (await server.reviewedFiles('refs/heads/feature')).marks.map(
      (mark) => mark.path,
    );
  await pairedPage
    .getByRole('button', { name: 'Mark notes.md as reviewed' })
    .first()
    .click();
  await expect.poll(branchMarks).toEqual(['notes.md']);
  await expect
    .element(
      pairedPage
        .getByRole('button', { name: 'Unmark notes.md as unreviewed' })
        .first(),
    )
    .toBeEnabled();
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);
});

test('a comment on a branch file is saved against the branch and waits for the agent', async ({
  pairedPage,
  server,
}) => {
  const body = 'Why a second line?';
  const tip = (await server.branchChanges()).head.oid;
  await pairedPage
    .getByRole('button', { name: 'Comment on notes.md (added)' })
    .click();
  await pairedPage.getByRole('textbox', { name: 'Comment' }).fill(body);
  await pairedPage
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('Waiting for the agent'))
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
});

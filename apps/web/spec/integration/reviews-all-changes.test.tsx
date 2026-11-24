import { page, userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

for (const surface of ['Files'] as const) {
  test(`a clean worktree keeps Review open and reaches ${surface} from its notice`, async ({
    repo,
    render,
  }) => {
    await repo.commit('Commit the sample change');
    const workspace = await render.workspace();
    const changes = workspace
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Review', exact: true });
    await expect
      .element(workspace.getByText('No changes to review.', { exact: true }))
      .toBeVisible();
    await changes.click();
    await userEvent.keyboard('{Alt>}w{/Alt}');
    await expect.element(changes).toBeVisible();
    await expect
      .element(
        workspace.getByRole('button', { name: 'Close Review', exact: true }),
      )
      .not.toBeInTheDocument();
    await workspace
      .getByRole('button', { name: new RegExp(`^${surface}`) })
      .click();
    const panel = workspace.getByRole('dialog', {
      name: 'Worktree review',
      exact: true,
    });
    await expect
      .element(
        panel.getByRole('tab', { name: surface, selected: true, exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(panel).not.toBeInTheDocument();
    await expect
      .element(
        workspace.getByRole('button', { name: new RegExp(`^${surface}`) }),
      )
      .toHaveFocus();
    await expect
      .element(workspace.getByText('No changes to review.', { exact: true }))
      .toBeVisible();
  });
}

test('All changes lists its files above the diff and marks them reviewed at desktop width', async ({
  workspace,
  repo,
  server,
  reviewLayout,
}) => {
  await page.viewport(1440, 900);
  try {
    await expect
      .element(
        workspace.getByRole('complementary', {
          name: 'Review sidebar',
          exact: true,
        }),
      )
      .toBeVisible();
    await reviewLayout.openAllChanges();
    const table = workspace.getByRole('region', {
      name: '1 uncommitted change',
      exact: true,
    });
    await expect
      .element(table.getByText('0 of 1 file reviewed', { exact: true }))
      .toBeVisible();
    const row = table.getByRole('button', {
      name: `${repo.readme.path} +2 −0`,
      exact: true,
    });
    await expect.element(row).toHaveAttribute('aria-current', 'true');
    const reviewed = table.getByRole('checkbox', {
      name: `${repo.readme.path} reviewed`,
      exact: true,
    });
    await expect.element(reviewed).toHaveAttribute('aria-checked', 'false');
    await reviewed.click();
    await expect.element(reviewed).toHaveAttribute('aria-checked', 'true');
    await expect
      .element(table.getByText('1 of 1 file reviewed', { exact: true }))
      .toBeVisible();
    await expect
      .poll(async () =>
        (await server.reviewedFiles()).marks.map((mark) => mark.path),
      )
      .toEqual([repo.readme.path]);

    await repo.write('notes.md', 'First note\nSecond note\n');
    const both = workspace.getByRole('region', {
      name: '2 uncommitted changes',
      exact: true,
    });
    const notes = both.getByRole('button', {
      name: 'notes.md +2 −0',
      exact: true,
    });
    await notes.click();
    await expect.element(notes).toHaveAttribute('aria-current', 'true');
    await expect
      .element(
        both.getByRole('button', {
          name: `${repo.readme.path} +2 −0`,
          exact: true,
        }),
      )
      .not.toHaveAttribute('aria-current');
    await expect
      .element(
        workspace
          .getByRole('region', { name: 'Code content', exact: true })
          .getByText('Second note', { exact: true }),
      )
      .toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

test('All changes keeps file shortcuts without redundant header arrows', async ({
  repo,
  render,
  reviewLayout,
}) => {
  await repo.write('zz-notes.md', 'First note\nSecond note\n');
  const workspace = await render.workspace();
  await reviewLayout.openAllChanges();
  const table = workspace.getByRole('region', {
    name: '2 uncommitted changes',
    exact: true,
  });
  const currentRows = () => reviewLayout.currentChangeRows(table);
  await table
    .getByRole('button', { name: 'zz-notes.md +2 −0', exact: true })
    .click();
  await expect
    .element(
      workspace
        .getByRole('button', { name: 'Previous file', exact: true })
        .first(),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Next file', exact: true }).first(),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('K');
  await expect.poll(currentRows).toEqual(['README.md+2−0']);
  await userEvent.keyboard('J');
  await expect.poll(currentRows).toEqual(['zz-notes.md+2−0']);
});

test('All changes moves to the previous listed file while its diff is still loading and shows it once it renders', async ({
  repo,
  render,
  fetchGate,
  reviewLayout,
}) => {
  await repo.write(
    'zz-notes.md',
    `${Array.from({ length: 80 }, (_, index) => `Note ${index + 1}`).join('\n')}\n`,
  );
  const held = fetchGate.holdNextChangeDiff();
  held.arm();
  try {
    const workspace = await render.workspace();
    await held.requested;
    await reviewLayout.openAllChanges();
    const table = workspace.getByRole('region', {
      name: '2 uncommitted changes',
      exact: true,
    });
    const currentRows = () => reviewLayout.currentChangeRows(table);
    await expect.poll(currentRows).toEqual(['README.md']);
    await table
      .getByRole('button', { name: 'zz-notes.md +80 −0', exact: true })
      .click();
    await expect.poll(currentRows).toEqual(['zz-notes.md+80−0']);
    await userEvent.keyboard('K');
    await expect.poll(currentRows).toEqual(['README.md']);
    const code = workspace.getByRole('region', {
      name: 'Code content',
      exact: true,
    });
    await expect
      .element(code.getByText('Note 1', { exact: true }))
      .toBeInViewport();
    held.release();
    await expect
      .element(code.getByText('A change to review.', { exact: true }))
      .toBeInViewport();
    await expect.poll(currentRows).toEqual(['README.md+2−0']);
  } finally {
    held.release();
  }
});

test('All changes reopens a collapsed file from its table', async ({
  workspace,
  repo,
  reviewLayout,
}) => {
  await reviewLayout.openAllChanges();
  const code = workspace
    .getByRole('region', { name: 'Code content', exact: true })
    .getByText('A change to review.', { exact: true });
  await expect.element(code).toBeVisible();
  await workspace
    .getByRole('button', { name: `Collapse ${repo.readme.path}`, exact: true })
    .click();
  await expect.element(code).not.toBeInTheDocument();
  await workspace
    .getByRole('region', { name: '1 uncommitted change', exact: true })
    .getByRole('button', { name: `${repo.readme.path} +2 −0`, exact: true })
    .click();
  await expect.element(code).toBeVisible();
});

test('All changes keeps the selected file when an earlier diff finishes loading', async ({
  repo,
  render,
  fetchGate,
  reviewLayout,
}) => {
  await repo.write('zz-notes.md', 'A later file\n');
  const held = fetchGate.holdNextChangeDiff();
  held.arm();
  try {
    const workspace = await render.workspace();
    await held.requested;
    await reviewLayout.openAllChanges();
    const table = workspace.getByRole('region', {
      name: '2 uncommitted changes',
      exact: true,
    });
    const currentRows = () => reviewLayout.currentChangeRows(table);
    await table
      .getByRole('button', { name: 'zz-notes.md +1 −0', exact: true })
      .click();
    await expect.poll(currentRows).toEqual(['zz-notes.md+1−0']);
    held.release();
    await expect
      .element(
        workspace
          .getByRole('region', { name: 'Code content', exact: true })
          .getByText('A change to review.', { exact: true }),
      )
      .toBeInTheDocument();
    await expect.poll(currentRows).toEqual(['zz-notes.md+1−0']);
  } finally {
    held.release();
  }
});

const reviewCode = (screen: typeof page, scope: 'branch' | 'uncommitted') =>
  screen.getByRole('region', {
    name: `Every changed file: ${scope}`,
    exact: true,
  });

test('Review shows local changes while the branch comparison is still being read', async ({
  render,
  fetchGate,
}) => {
  const held = fetchGate.holdNextBranchRead();
  held.arm();
  try {
    const app = await render.route('/');
    await held.requested;
    await expect
      .element(
        reviewCode(app.page, 'uncommitted').getByText('A change to review.', {
          exact: true,
        }),
      )
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('Review reads a held patch without loading words or placeholders', async ({
  repo,
  render,
  fetchGate,
}) => {
  const held = fetchGate.holdNextChangeDiff(repo.readme.path);
  held.arm();
  try {
    const app = await render.route('/');
    await held.requested;
    await expect
      .element(
        app.page.getByRole('heading', {
          name: 'No walkthrough yet.',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(app.page.getByText(/Loading|Reading/u))
      .not.toBeInTheDocument();
    held.release();
    await expect
      .element(
        reviewCode(app.page, 'uncommitted').getByText('A change to review.', {
          exact: true,
        }),
      )
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('a first commit shows its local file in Review without a comparison error', async ({
  repo,
  render,
}) => {
  await repo.commit('Settle the sample change');
  await repo.orphan('first');
  await repo.write('first.md', 'The very first file\n');
  const app = await render.route('/');
  await expect
    .element(
      reviewCode(app.page, 'uncommitted').getByText('The very first file', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('The branch could not be compared. Try again.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(app.page.getByRole('button', { name: 'Try again', exact: true }))
    .not.toBeInTheDocument();
});

test('Review reads more local files only when asked', async ({
  repo,
  render,
}) => {
  for (let index = 0; index < 30; index += 1)
    await repo.write(
      `note-${String(index).padStart(2, '0')}.md`,
      `Note number ${index}\n`,
    );
  const app = await render.route('/');
  const local = reviewCode(app.page, 'uncommitted');
  await expect
    .element(local.getByText('Note number 23', { exact: true }))
    .toBeVisible();
  await expect
    .element(local.getByText('Note number 29', { exact: true }))
    .not.toBeInTheDocument();
  await local
    .getByRole('button', { name: 'Read 6 more of 31', exact: true })
    .click();
  await expect
    .element(local.getByText('Note number 29', { exact: true }))
    .toBeVisible();
});

test('a hidden Review reads no patches until it is shown again', async ({
  repo,
  render,
  server,
}) => {
  await repo.write('guide.txt', 'A committed guide\n');
  await repo.commit('Add a guide');
  await repo.write(repo.readme.path, '# Sample repository\n\nBefore\n');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const app = await render.route(`/${project.id}/${worktree.id}`);
  const local = reviewCode(app.page, 'uncommitted');
  await expect
    .element(local.getByText('Before', { exact: true }))
    .toBeVisible();
  await app.navigate(`/${project.id}/${worktree.id}?entry=file:guide.txt`);
  await expect
    .element(app.page.getByRole('heading', { name: 'guide.txt', exact: true }))
    .toBeVisible();
  const lists = (await server.changeListHits()).length;
  const patches = (await server.changeDiffHits()).length;
  await repo.write(repo.readme.path, '# Sample repository\n\nAfter\n');
  await expect
    .poll(async () => (await server.changeListHits()).length)
    .toBeGreaterThan(lists);
  await expect(
    expect
      .poll(async () => (await server.changeDiffHits()).length, {
        timeout: 2000,
      })
      .toBeGreaterThan(patches),
  ).rejects.toThrow();
  await app.page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect.element(local.getByText('After', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await server.changeDiffHits()).length)
    .toBeGreaterThan(patches);
});

test('a hidden Review reads no untracked text until it is shown again', async ({
  repo,
  render,
  server,
  fetchGate,
}) => {
  await repo.write('guide.txt', 'A committed guide\n');
  await repo.commit('Add a guide');
  await repo.write('draft.md', 'First draft\n');
  const reads = fetchGate.recordTextReads();
  const drafts = () => reads.filter((path) => path === 'draft.md').length;
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const app = await render.route(`/${project.id}/${worktree.id}`);
  const local = reviewCode(app.page, 'uncommitted');
  await expect
    .element(local.getByText('First draft', { exact: true }))
    .toBeVisible();
  await expect.poll(drafts).toBeGreaterThan(0);
  await app.navigate(`/${project.id}/${worktree.id}?entry=file:guide.txt`);
  await expect
    .element(app.page.getByRole('heading', { name: 'guide.txt', exact: true }))
    .toBeVisible();
  const lists = (await server.changeListHits()).length;
  const before = drafts();
  await repo.write('draft.md', 'Second draft\n');
  await expect
    .poll(async () => (await server.changeListHits()).length)
    .toBeGreaterThan(lists);
  await expect(
    expect.poll(drafts, { timeout: 2000 }).toBeGreaterThan(before),
  ).rejects.toThrow();
  await app.page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect
    .element(local.getByText('Second draft', { exact: true }))
    .toBeVisible();
});

test('Review never calls an untracked file unreadable while its text is being read', async ({
  repo,
  render,
  fetchGate,
}) => {
  await repo.write('draft.md', 'A readable draft\n');
  const held = fetchGate.holdNextTextRead('draft.md');
  held.arm();
  try {
    const app = await render.route('/');
    await held.requested;
    await expect
      .element(
        app.page.getByRole('heading', {
          name: 'No walkthrough yet.',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(app.page.getByText('Not readable', { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(app.page.getByText('Non-text content', { exact: true }))
      .not.toBeInTheDocument();
    held.release();
    await expect
      .element(
        reviewCode(app.page, 'uncommitted').getByText('A readable draft', {
          exact: true,
        }),
      )
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('a cold split shows no loading skeleton while its side document is read', async ({
  repo,
  render,
  server,
  fetchGate,
}) => {
  await repo.write('notes.txt', 'Side notes\n');
  await repo.commit('Add side notes');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const held = fetchGate.holdNextTextRead('notes.txt');
  held.arm();
  try {
    const app = await render.route(
      `/${project.id}/${worktree.id}?entry=review&side=file:notes.txt`,
    );
    await held.requested;
    await expect
      .element(
        app.page.getByRole('region', { name: 'Right pane', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(app.page.getByText(/Loading|Reading/u))
      .not.toBeInTheDocument();
    held.release();
    await expect
      .element(app.page.getByText('Side notes', { exact: true }))
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('a failed branch comparison never reads as no changes in Review', async ({
  repo,
  render,
  fetchGate,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'Committed notes\n');
  await repo.commit('Add notes on the branch');
  fetchGate.failBranchReads();
  const app = await render.route('/');
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'No walkthrough yet.',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(app.page.getByText('No changes to review.', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(app.page.getByRole('button', { name: 'Try again', exact: true }))
    .not.toBeInTheDocument();
  await app.navigate(`${app.location().split('?')[0]}?entry=branch`);
  await expect
    .element(app.page.getByRole('button', { name: 'Try again', exact: true }))
    .toBeVisible();
});

test('Review offers no review or discard on a patch it is still replacing', async ({
  repo,
  render,
  fetchGate,
}) => {
  const held = fetchGate.holdNextPost('/changes/diffs');
  const app = await render.route('/');
  const local = reviewCode(app.page, 'uncommitted');
  const mark = local.getByRole('button', {
    name: `Mark ${repo.readme.path} as reviewed`,
    exact: true,
  });
  await expect
    .element(local.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await expect.element(mark).toBeVisible();
  held.arm();
  try {
    await repo.write(
      repo.readme.path,
      '# Sample repository\n\nA newer edit.\n',
    );
    await held.requested;
    await expect
      .element(local.getByText('A change to review.', { exact: true }))
      .toBeVisible();
    await expect.element(mark).not.toBeInTheDocument();
    held.release();
    await expect
      .element(local.getByText('A newer edit.', { exact: true }))
      .toBeVisible();
    await expect.element(mark).toBeVisible();
  } finally {
    held.release();
  }
});

test('Review offers no review on a non-text file whose new patch is still being read', async ({
  repo,
  render,
  fetchGate,
}) => {
  await repo.write('data.bin', 'text before\n');
  await repo.commit('Add data');
  await repo.write(repo.readme.path, '# Sample repository\n\nAnother edit.\n');
  await repo.write('data.bin', 'binary\u0000content\n');
  const held = fetchGate.holdNextPost('/changes/diffs');
  const app = await render.route('/');
  const local = reviewCode(app.page, 'uncommitted');
  const omitted = local.getByRole('listitem', {
    name: 'data.bin: Binary change',
    exact: true,
  });
  const mark = omitted.getByRole('button', {
    name: 'Mark data.bin as reviewed',
    exact: true,
  });
  await expect.element(mark).toBeVisible();
  held.arm();
  try {
    await repo.write('data.bin', 'text after\n');
    await held.requested;
    await expect.element(omitted).toBeVisible();
    await expect.element(mark).not.toBeInTheDocument();
    held.release();
    await expect
      .element(local.getByText('text after', { exact: true }))
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('All changes lists and reads its first files, and the next ones only when asked', async ({
  repo,
  workspace,
  reviewLayout,
}) => {
  for (let index = 0; index < 60; index += 1)
    await repo.write(
      `note-${String(index).padStart(2, '0')}.md`,
      `Note number ${index}\n`,
    );
  await reviewLayout.openAllChanges();
  const table = workspace.getByRole('region', {
    name: '61 uncommitted changes',
    exact: true,
  });
  await expect
    .element(table.getByText('0 of 61 files reviewed', { exact: true }))
    .toBeVisible();
  await expect
    .element(table.getByRole('button', { name: /^note-23\.md/ }))
    .toBeVisible();
  await expect
    .element(table.getByRole('button', { name: /^note-30\.md/ }))
    .not.toBeInTheDocument();
  await workspace
    .getByRole('button', { name: /^Read 25 more of \d+$/ })
    .click();
  await table.getByRole('button', { name: /^note-30\.md/ }).click();
  await expect
    .element(
      workspace
        .getByRole('region', { name: 'Code content', exact: true })
        .getByText('Note number 30', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByRole('button', { name: /^Read 11 more of \d+$/ }))
    .toBeVisible();
});

test('All changes preserves readable diffs and retries a failed final window', async ({
  repo,
  render,
  server,
  fetchGate,
}) => {
  const notes = Array.from(
    { length: 30 },
    (_, index) => `note-${String(index).padStart(2, '0')}.md`,
  );
  for (const path of notes) await repo.write(path, `Original ${path}\n`);
  await repo.commit('Track the notes');
  for (const path of notes) await repo.write(path, `Edited ${path}\n`);

  const outage = fetchGate.failChangeDiffs();
  const held = fetchGate.holdNextPost('/changes/diffs');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const { page: workspace } = await render.route(
    `/${project.id}/${worktree.id}?entry=all-changes`,
  );
  const table = workspace.getByRole('region', {
    name: '30 uncommitted changes',
    exact: true,
  });
  const content = workspace.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  const first = content.getByText('Edited note-00.md', { exact: true });
  const firstRow = table.getByRole('button', { name: /^note-00\.md/ });
  await firstRow.click();
  await expect.element(first).toBeVisible();
  held.arm();

  try {
    await workspace
      .getByRole('button', { name: /^Read 5 more of \d+$/ })
      .click();
    await held.requested;
    await firstRow.click();
    await expect.element(first).toBeVisible();

    outage.start();
    held.release();
    const retry = workspace.getByRole('button', {
      name: 'Try again',
      exact: true,
    });
    await expect.element(retry).toBeVisible();
    await firstRow.click();
    await expect.element(first).toBeVisible();

    outage.stop();
    await retry.click();
    const lastRow = table.getByRole('button', { name: /^note-29\.md \+/ });
    await expect.element(lastRow).toBeVisible();
    await lastRow.click();
    await expect
      .element(content.getByText('Edited note-29.md', { exact: true }))
      .toBeVisible();
    await expect.element(retry).not.toBeInTheDocument();
  } finally {
    fetchGate.restore();
  }
});

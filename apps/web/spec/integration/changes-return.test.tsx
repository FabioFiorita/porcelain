import { expect, test } from './fixtures.tsx';

test.for(['handoff', 'change:long.txt'])(
  'a diff keeps its reading position across tab return and live refresh in %s',
  async (entry, { repo, render, reviewLayout, fetchGate, server }) => {
    const path = 'long.txt';
    const lines = Array.from(
      { length: 400 },
      (_, index) => `before line ${index + 1}`,
    ).join('\n');
    await repo.write(path, lines);
    await repo.commit('Add long text');
    await repo.write(path, lines.replaceAll('before', 'after'));
    await repo.write(repo.readme.path, '# Another changed file\n');
    const gate = fetchGate.holdNextPost('/changes/diffs');
    const app = await render.route('/');
    await expect
      .element(app.page.getByRole('tab', { name: 'Changes', exact: true }))
      .toBeVisible();
    await app.navigate(
      `${app.location().split('?')[0]}?entry=${encodeURIComponent(entry)}`,
    );
    const code = app.page.getByRole('region', {
      name: 'Code content',
      exact: true,
    });
    await expect
      .element(code.getByText('before line 1', { exact: true }))
      .toBeVisible();
    reviewLayout.scrollCodeTo(code, 1200);
    await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(1200);
    if (entry !== 'handoff') {
      await app.page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await app.page.getByRole('tab', { name: path, exact: true }).click();
      await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(1200);
    }
    gate.arm();
    try {
      await repo.write(
        entry === 'handoff' ? repo.readme.path : path,
        entry === 'handoff'
          ? '# Another writer changed this file\n'
          : `${lines.replaceAll('before', 'after')}\nAnother writer appended this line\n`,
      );
      await gate.requested;
      gate.release();
      await expect.poll(() => gate.responded()).toBe(true);
      await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(1200);
      await expect
        .poll(async () => (await server.reviewedFiles()).marks)
        .toEqual([]);
    } finally {
      gate.release();
    }
  },
);

test('the branch base is selectable from its document with the side panel closed', async ({
  repo,
  render,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('first.md', 'first\n');
  await repo.commit('First change');
  await repo.branch('checkpoint');
  await repo.write('second.md', 'second\n');
  await repo.commit('Second change');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(2);
  const app = await render.route('/');
  await expect
    .element(app.page.getByRole('tab', { name: 'Changes', exact: true }))
    .toBeVisible();
  await app.navigate(
    `${app.location().split('?')[0]}?entry=handoff&scope=branch`,
  );
  const controls = app.page.getByRole('toolbar', {
    name: 'Document controls',
    exact: true,
  });
  await controls
    .getByRole('button', { name: 'Compare against main', exact: true })
    .click();
  await app.page
    .getByRole('option', { name: 'checkpoint', exact: true })
    .click();
  await expect
    .poll(() => new URL(app.location(), 'http://test').searchParams.get('base'))
    .toBe('refs/heads/checkpoint');
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'feature since checkpoint',
        exact: true,
      }),
    )
    .toBeVisible();
  await app.navigate(
    `${app.location().split('?')[0]}?entry=branch:second.md&scope=branch&base=refs%2Fheads%2Fcheckpoint`,
  );
  await app.page
    .getByRole('group', { name: 'Branch comparison', exact: true })
    .getByRole('button', { name: 'Compare against checkpoint', exact: true })
    .click();
  await app.page
    .getByRole('option', { name: 'main default', exact: true })
    .click();
  await expect
    .poll(() => new URL(app.location(), 'http://test').searchParams.get('base'))
    .toBeNull();
  await expect
    .element(
      app.page
        .getByRole('group', { name: 'Branch comparison', exact: true })
        .getByRole('button', {
          name: 'Compare against main',
          exact: true,
        }),
    )
    .toBeVisible();
});

test('a retained line selection cannot target changed code after a refresh', async ({
  repo,
  render,
  reviewLayout,
  server,
}) => {
  const path = 'selected.txt';
  const source = Array.from(
    { length: 8 },
    (_, index) => `before line ${index + 1}`,
  ).join('\n');
  await repo.write(path, source);
  await repo.commit('Add selection fixture');
  await repo.write(path, source.replaceAll('before', 'after'));
  const app = await render.route('/');
  await expect
    .element(app.page.getByRole('tab', { name: 'Changes', exact: true }))
    .toBeVisible();
  await app.navigate(`${app.location().split('?')[0]}?entry=change:${path}`);
  const code = app.page.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  await expect
    .element(code.getByText('after line 3', { exact: true }))
    .toBeVisible();
  await code.getByText('after line 3', { exact: true }).hover();
  await code.getByRole('button', { name: '', exact: true }).last().click();
  await expect
    .poll(() => reviewLayout.highlightedCode(code))
    .toContain('after line 3');
  await app.page.getByRole('tab', { name: 'Changes', exact: true }).click();
  await app.page.getByRole('tab', { name: path, exact: true }).click();
  await expect
    .poll(() => reviewLayout.highlightedCode(code))
    .toContain('after line 3');
  await repo.write(
    path,
    source
      .replaceAll('before', 'after')
      .replace('after line 3', 'changed selected line'),
  );
  await expect
    .element(code.getByText('changed selected line', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      code.getByText(
        'Code changed since these lines were selected. Select lines again.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect.poll(() => reviewLayout.highlightedCode(code)).toBe('');
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);
});

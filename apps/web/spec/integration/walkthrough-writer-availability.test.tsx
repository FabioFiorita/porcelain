import { expect, test } from './fixtures.tsx';

test('an unwritten walkthrough explains its comparison and blocks writing until a writer is available', async ({
  repo,
  render,
  codingTool,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'A change to explain\n');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await expect
    .element(
      page.getByText('Whole change since main, including uncommitted work.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByText('Writer: Claude / claude-opus-5-5 · high', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('No writers available', { exact: true }))
    .toBeVisible();
  const write = page.getByRole('button', {
    name: 'Write walkthrough',
    exact: true,
  });
  await expect.element(write).toBeDisabled();
  await codingTool.install();
  await page
    .getByRole('button', { name: 'Check writers again', exact: true })
    .click();
  await expect
    .element(
      page.getByText('Writer: Claude / Opus 5.5 · high', { exact: true }),
    )
    .toBeVisible();
  await expect.element(write).toBeEnabled();
});

test('writer settings show install and sign-in guidance instead of an empty disabled model list', async ({
  render,
}) => {
  const app = await render.route('/settings/git');
  const page = app.page;
  await expect
    .element(page.getByText('No writers available', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('claude auth login', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('codex login', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('combobox', { name: 'Walkthrough writer', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByRole('combobox', { name: 'Walkthrough effort', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Save', exact: true }))
    .not.toBeInTheDocument();
});

test('project automation stays editable when no writers are available and checking does not submit the form', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const actions = navigator.getByRole('button', {
    name: `Project actions: ${project.name} · ${computer}`,
    exact: true,
  });
  const open = async () => {
    await actions.click();
    await navigator
      .getByRole('menuitem', { name: 'Walkthrough settings', exact: true })
      .click();
  };
  await open();
  const dialog = navigator.getByRole('dialog', {
    name: `Walkthroughs for ${project.name}`,
    exact: true,
  });
  await expect
    .element(dialog.getByText('No writers available', { exact: true }))
    .toBeVisible();
  const mode = dialog.getByRole('combobox', {
    name: 'Walkthrough mode',
    exact: true,
  });
  await mode.click();
  await navigator
    .getByRole('option', {
      name: 'Automatic when a pull request opens',
      exact: true,
    })
    .click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => (await server.project()).walkthroughSettings?.mode)
    .toBe('automatic');
  await expect.element(dialog).not.toBeInTheDocument();
  await open();
  const check = dialog.getByRole('button', {
    name: 'Check writers again',
    exact: true,
  });
  await check.click();
  await expect.element(check).toBeEnabled();
  await expect.element(dialog).toBeVisible();
  await mode.click();
  await navigator.getByRole('option', { name: 'Manual', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => (await server.project()).walkthroughSettings?.mode)
    .toBe('manual');
});

test('an unavailable project override opens its own settings and clearing it enables writing', async ({
  repo,
  render,
  codingTool,
  server,
}) => {
  await codingTool.install();
  const project = await server.project();
  await repo.walkthroughSettings(project.id, {
    mode: 'manual',
    writer: { provider: 'codex', model: 'removed-model', effort: 'high' },
  });
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await expect
    .element(
      page.getByText('Writer: Codex / removed-model · high', { exact: true }),
    )
    .toBeVisible();
  const write = page.getByRole('button', {
    name: 'Write walkthrough',
    exact: true,
  });
  await expect.element(write).toBeDisabled();
  await page
    .getByRole('button', { name: 'Project walkthrough settings', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: `Walkthroughs for ${project.name}`,
    exact: true,
  });
  await expect.element(dialog).toBeVisible();
  await dialog
    .getByRole('combobox', { name: 'Walkthrough writer', exact: true })
    .click();
  await page
    .getByRole('option', {
      name: 'Use the default · Claude / Opus 5.5 · high',
      exact: true,
    })
    .click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => (await server.project()).walkthroughSettings)
    .toEqual({ mode: 'manual' });
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(
      page.getByText('Writer: Claude / Opus 5.5 · high', { exact: true }),
    )
    .toBeVisible();
  await expect.element(write).toBeEnabled();
});

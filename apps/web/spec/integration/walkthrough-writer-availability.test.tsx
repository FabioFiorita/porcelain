import { conversationFixture, expect, test } from './fixtures.tsx';

test('an unwritten walkthrough offers one action: checking writers until one is available, then writing', async ({
  repo,
  render,
  codingTool,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'A change to explain\n');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect
    .element(
      page.getByText(
        'Sign in to Claude Code or Codex on the connected computer.',
        { exact: true },
      ),
    )
    .toBeVisible();
  const write = page.getByRole('button', {
    name: 'Write walkthrough',
    exact: true,
  });
  await expect.element(write).not.toBeInTheDocument();
  await codingTool.install();
  await page
    .getByRole('button', { name: 'Check writers again', exact: true })
    .click();
  await expect
    .element(
      page.getByText('Since main · Claude / Opus 5.5 · high', { exact: true }),
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
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect
    .element(
      page.getByText('Codex / removed-model · high is unavailable.', {
        exact: true,
      }),
    )
    .toBeVisible();
  const write = page.getByRole('button', {
    name: 'Write walkthrough',
    exact: true,
  });
  await expect.element(write).not.toBeInTheDocument();
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
    .element(page.getByText(/^Since .+ · Claude \/ Opus 5\.5 · high$/u))
    .toBeVisible();
  await expect.element(write).toBeEnabled();
});

const unsupportedWriter = {
  provider: 'codex',
  model: 'fixture-model',
  effort: 'high',
} as const;
const unsupportedNote = "Fixture model doesn't support high effort.";

test('disables Write and Save until the saved effort is changed', async ({
  repo,
  render,
  codingTool,
  server,
}) => {
  const project = await server.project();
  await codingTool.codexEffort(true);
  await repo.walkthroughSettings(project.id, {
    mode: 'manual',
    writer: unsupportedWriter,
  });
  await codingTool.codexEffort(false);
  const { page } = await render.route('/');
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  const write = page.getByRole('button', {
    name: 'Write walkthrough',
    exact: true,
  });
  await expect
    .element(page.getByText(unsupportedNote, { exact: true }))
    .toBeVisible();
  await expect.element(write).toBeDisabled();
  await page
    .getByRole('button', { name: 'Project walkthrough settings', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: `Walkthroughs for ${project.name}`,
    exact: true,
  });
  await expect
    .element(dialog.getByText(unsupportedNote, { exact: true }))
    .toBeVisible();
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await expect.element(save).toBeDisabled();
  await dialog
    .getByRole('combobox', { name: 'Walkthrough effort', exact: true })
    .click();
  await page.getByRole('option', { name: 'medium', exact: true }).click();
  await expect.element(save).toBeEnabled();
  await save.click();
  await expect
    .poll(
      async () => (await server.project()).walkthroughSettings?.writer?.effort,
    )
    .toBe('medium');
  await expect.element(write).toBeEnabled();
});

test.for([
  ['pr', 'Update walkthrough'],
  ['failed-update', 'Try again'],
] as const)(
  'blocks the %s writer action when the saved effort disappears',
  async ([scenario, button], { repo, render, codingTool, server }) => {
    await conversationFixture(scenario);
    const project = await server.project();
    await codingTool.codexEffort(true);
    await repo.walkthroughSettings(project.id, {
      mode: 'manual',
      writer: unsupportedWriter,
    });
    await codingTool.codexEffort(false);
    const { page } = await render.route('/');
    await expect
      .element(page.getByRole('button', { name: button, exact: true }))
      .toBeDisabled();
    await expect
      .element(page.getByText(unsupportedNote, { exact: true }))
      .toBeVisible();
  },
);

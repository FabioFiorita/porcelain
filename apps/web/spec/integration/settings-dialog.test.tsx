import { page, userEvent } from 'vite-plus/test/browser';
import { expect, test, type Render } from './fixtures.tsx';

type Projects = {
  project: () => Promise<{
    id: string;
    worktrees: readonly { id: string; main: boolean }[];
  }>;
};

function pathname(location: string) {
  return location.split(/[?#]/u)[0];
}

async function openWorktree(
  render: Render,
  server: Projects,
  entry = '',
  width = 1440,
) {
  await page.viewport(width, 896);
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  const path = `/${project.id}/${worktree.id}`;
  const app = await render.route(`${path}${entry}`);
  const content = app.page.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect.element(content).toBeVisible();
  const opener = app.page
    .getByRole('navigation', { name: 'Projects and worktrees', exact: true })
    .getByRole('button', { name: 'Settings', exact: true });
  const settings = app.page.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  const toggle = app.page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  const openSettings = async () => {
    if (width < 768) await toggle.click();
    await opener.click();
    await expect.element(settings).toBeVisible();
  };
  return { app, path, content, opener, settings, toggle, openSettings };
}

test('leaving Settings with Back keeps the same workspace mounted', async ({
  render,
  server,
  reviewLayout,
}) => {
  try {
    const { app, path, content } = await openWorktree(render, server);
    const mounted = reviewLayout.stillMounted(content);
    await app.navigate('/settings/general');
    await expect
      .element(app.page.getByRole('heading', { name: 'General', exact: true }))
      .toBeVisible();
    await app.back();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(content).toBeVisible();
    await expect.poll(mounted).toBe(true);
  } finally {
    await page.viewport(414, 896);
  }
});

for (const way of ['Close', 'Escape', 'a click outside', 'Back'] as const) {
  test(`${way} closes Settings over the same workspace and returns focus to its opener`, async ({
    render,
    server,
    reviewLayout,
  }) => {
    try {
      const { app, path, content, opener, settings } = await openWorktree(
        render,
        server,
      );
      const mounted = reviewLayout.stillMounted(content);
      await opener.click();
      await expect.element(settings).toBeVisible();
      await expect
        .poll(() => pathname(app.location()))
        .toBe('/settings/general');
      await expect.poll(mounted).toBe(true);
      if (way === 'Close')
        await settings
          .getByRole('button', { name: 'Close', exact: true })
          .click();
      else if (way === 'Escape') await userEvent.keyboard('{Escape}');
      else if (way === 'Back') await app.back();
      else await reviewLayout.pressPageCorner();
      await expect.element(settings).not.toBeInTheDocument();
      await expect.poll(() => pathname(app.location())).toBe(path);
      await expect.poll(mounted).toBe(true);
      await expect.element(opener).toHaveFocus();
    } finally {
      await page.viewport(414, 896);
    }
  });
}

test('workspace shortcuts stay inert while Settings is open', async ({
  render,
  server,
  repo,
}) => {
  try {
    const readme = repo.readme.path;
    await repo.write(readme, 'Reviewed only on purpose\n');
    const { app, path, opener, settings } = await openWorktree(
      render,
      server,
      `?entry=change:${readme}`,
    );
    const reviewed = app.page
      .getByRole('toolbar', { name: 'Document controls', exact: true })
      .getByRole('button', { name: 'Reviewed', exact: true });
    const tab = app.page.getByRole('tab', {
      name: new RegExp(readme),
      exact: true,
    });
    const quickOpen = app.page.getByRole('combobox', {
      name: 'Find a file by name',
      exact: true,
    });
    const marked = async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path);
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'false');
    await opener.click();
    await expect.element(settings).toBeVisible();
    await userEvent.keyboard('r');
    await userEvent.keyboard('{Alt>}w{/Alt}');
    await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
    await userEvent.keyboard('{Alt>}{Shift>}S{/Shift}{/Alt}');
    await expect.element(quickOpen).not.toBeInTheDocument();
    await settings.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(tab).toBeVisible();
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(marked).toEqual([]);
    await userEvent.keyboard('r');
    await expect.poll(marked).toContain(readme);
    await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
    await expect.element(quickOpen).toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

for (const width of [1440, 414]) {
  test(`the navigator shortcut leaves the workspace alone while Settings is open at ${width}`, async ({
    render,
    server,
  }) => {
    try {
      const { app, opener, settings, toggle, openSettings } =
        await openWorktree(render, server, '', width);
      await openSettings();
      const general = settings.getByRole('button', {
        name: 'General',
        exact: true,
      });
      await expect.element(general).toHaveFocus();
      await userEvent.keyboard('{Control>}b{/Control}');
      await expect
        .element(app.page.getByRole('dialog', { name: 'Sidebar', exact: true }))
        .not.toBeInTheDocument();
      await expect.element(general).toHaveFocus();
      await settings
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await expect.element(settings).not.toBeInTheDocument();
      await expect.element(width < 768 ? toggle : opener).toHaveFocus();
    } finally {
      await page.viewport(414, 896);
    }
  });
}

for (const way of ['Close', 'Back'] as const) {
  test(`${way} from Settings opened in the phone sidebar returns focus to Toggle Sidebar`, async ({
    render,
    server,
  }) => {
    const { app, path, settings, toggle, openSettings } = await openWorktree(
      render,
      server,
      '',
      414,
    );
    await openSettings();
    if (way === 'Close')
      await settings
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    else await app.back();
    await expect.element(settings).not.toBeInTheDocument();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(toggle).toHaveFocus();
  });
}

test('Back after switching section from a computer detail returns to the workspace', async ({
  render,
  server,
}) => {
  try {
    const { app, path, settings, openSettings } = await openWorktree(
      render,
      server,
    );
    await openSettings();
    await settings
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    await settings
      .getByRole('button', { name: /^Open This computer:/u })
      .click();
    await expect
      .poll(() => pathname(app.location()))
      .toBe('/settings/computers/this-computer');
    await settings
      .getByRole('button', { name: 'General', exact: true })
      .click();
    await expect.poll(() => pathname(app.location())).toBe('/settings/general');
    await app.back();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(settings).not.toBeInTheDocument();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Escape from a detail opened by the Devices link returns to Computers, and Back then reaches the workspace', async ({
  render,
  server,
}) => {
  try {
    const { app, path, settings, openSettings } = await openWorktree(
      render,
      server,
    );
    await openSettings();
    await settings
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    await settings.getByRole('link', { name: /› Devices$/u }).click();
    await expect
      .poll(() => pathname(app.location()))
      .toBe('/settings/computers/this-computer');
    await userEvent.keyboard('{Escape}');
    await expect
      .poll(() => pathname(app.location()))
      .toBe('/settings/computers');
    await app.back();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(settings).not.toBeInTheDocument();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Close on Settings opened without a workspace replaces it, so Back does not reopen Settings', async ({
  render,
}) => {
  const app = await render.route('/settings/computers');
  const settings = app.page.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await expect.element(settings).toBeVisible();
  await settings.getByRole('button', { name: /^Open This computer:/u }).click();
  await expect
    .poll(() => pathname(app.location()))
    .toBe('/settings/computers/this-computer');
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.element(settings).not.toBeInTheDocument();
  await expect
    .element(
      app.page.getByRole('region', { name: 'Review content', exact: true }),
    )
    .toBeVisible();
  const workspace = app.location();
  await app.back();
  await expect.poll(() => app.location()).toBe(workspace);
  await expect.element(settings).not.toBeInTheDocument();
});

for (const width of [1440, 414]) {
  test(`with Mac key handling, Control+B and Command+B leave the workspace alone while Settings is open at ${width}`, async ({
    render,
    server,
    reviewLayout,
  }) => {
    const restore = reviewLayout.reportPlatform('MacIntel');
    try {
      const { app, opener, settings, toggle, openSettings } =
        await openWorktree(render, server, '', width);
      await openSettings();
      const general = settings.getByRole('button', {
        name: 'General',
        exact: true,
      });
      await expect.element(general).toHaveFocus();
      await userEvent.keyboard('{Control>}b{/Control}');
      await userEvent.keyboard('{Meta>}b{/Meta}');
      await expect
        .element(app.page.getByRole('dialog', { name: 'Sidebar', exact: true }))
        .not.toBeInTheDocument();
      await expect.element(general).toHaveFocus();
      await settings
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await expect.element(settings).not.toBeInTheDocument();
      await expect.element(width < 768 ? toggle : opener).toHaveFocus();
    } finally {
      restore();
      await page.viewport(414, 896);
    }
  });
}

for (const way of ['Close', 'Back'] as const) {
  test(`${way} from Settings opened by the phone sidebar's Manage computers returns focus to Toggle Sidebar`, async ({
    render,
    server,
  }) => {
    const { app, path, settings, toggle } = await openWorktree(
      render,
      server,
      '',
      414,
    );
    await toggle.click();
    await app.page.getByRole('button', { name: 'Update', exact: true }).click();
    await app.page
      .getByRole('button', { name: 'Manage computers', exact: true })
      .click();
    await expect.element(settings).toBeVisible();
    await expect
      .poll(() => pathname(app.location()))
      .toBe('/settings/computers');
    if (way === 'Close')
      await settings
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    else await app.back();
    await expect.element(settings).not.toBeInTheDocument();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await expect.element(toggle).toHaveFocus();
  });
}

test('Forward after switching section from a computer detail cannot reopen that detail', async ({
  render,
  server,
}) => {
  try {
    const { app, path, settings, openSettings } = await openWorktree(
      render,
      server,
    );
    await openSettings();
    await settings
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    await settings
      .getByRole('button', { name: /^Open This computer:/u })
      .click();
    await expect
      .poll(() => pathname(app.location()))
      .toBe('/settings/computers/this-computer');
    await settings
      .getByRole('button', { name: 'General', exact: true })
      .click();
    await expect.poll(() => pathname(app.location())).toBe('/settings/general');
    await app.back();
    await expect.poll(() => pathname(app.location())).toBe(path);
    await app.forward();
    await expect.poll(() => pathname(app.location())).toBe('/settings/general');
    await app.forward();
    await expect.poll(() => pathname(app.location())).toBe('/settings/general');
    await expect
      .element(settings.getByRole('heading', { name: 'General', exact: true }))
      .toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

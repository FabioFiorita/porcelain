import { page, userEvent } from 'vitest/browser';
import { expect, test, type Render } from './fixtures.tsx';

type Projects = {
  project: () => Promise<{
    id: string;
    worktrees: readonly { id: string; main: boolean }[];
  }>;
};

function pathname(location: string) {
  return location.split('?')[0];
}

async function openWorktree(render: Render, server: Projects, entry = '') {
  await page.viewport(1440, 896);
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
  return { app, path, content, opener, settings };
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

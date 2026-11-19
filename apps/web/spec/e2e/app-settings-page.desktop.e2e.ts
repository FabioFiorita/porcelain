import { closeSettings, openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('Settings opens over the review with one section at a time, and Close returns to the same review', async ({
  pairedPage,
}) => {
  const review = pairedPage.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect(review).toBeVisible();
  const mounted = await review.elementHandle();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'General', exact: true }).click();
  await expect(
    settings.getByText('Diff layout', { exact: true }),
  ).toBeVisible();

  await settings
    .getByRole('button', { name: 'Changes & Git', exact: true })
    .click();
  await expect(
    settings.getByRole('heading', { name: 'Changes & Git', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('Diff layout', { exact: true }),
  ).not.toBeAttached();

  await closeSettings(settings.page());
  await expect(review).toBeVisible();
  await expect
    .poll(() => mounted?.evaluate((element) => element.isConnected))
    .toBe(true);
});

test('Escape leaves Settings, except while typing in one of its fields', async ({
  page,
  pairedPage,
}) => {
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await openThisComputer(pairedPage);
  await settings.getByRole('button', { name: 'Rename', exact: true }).click();
  const name = settings.getByRole('textbox', {
    name: 'Name of this computer',
    exact: true,
  });
  await name.click();
  await page.keyboard.press('Escape');
  await expect(settings).toBeVisible();
  await expect(name).not.toBeAttached();
  await expect(
    settings.getByRole('button', { name: 'Rename', exact: true }),
  ).toBeFocused();

  await settings.getByRole('button', { name: 'General', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeAttached();
  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
});

test('Settings still opens once the last project is removed', async ({
  pairedPage,
  server,
}) => {
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', {
      name: `Project actions: ${project.name} · ${computer}`,
      exact: true,
    })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  await pairedPage
    .getByRole('alertdialog', {
      name: `Remove ${project.name} from Porcelain?`,
      exact: true,
    })
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();
  await expect(
    pairedPage.getByText('No projects registered', { exact: true }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await closeSettings(settings.page());
  await expect(
    pairedPage.getByText('Worktree not found', { exact: true }),
  ).toBeVisible();
});

test('Settings opens as a dialog over the worktrees, and a click outside closes it', async ({
  pairedPage,
}) => {
  await pairedPage.setViewportSize({ width: 1440, height: 960 });
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  const worktrees = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const open = worktrees.getByRole('button', { name: 'Settings', exact: true });
  await open.click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await expect(settings).toBeVisible();
  await expect(pairedPage).toHaveTitle('Settings — Porcelain');
  await expect(
    settings.getByRole('navigation', {
      name: 'Settings sections',
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const box = await settings.boundingBox();
      return box ? box.x : 0;
    })
    .toBeGreaterThan(0);
  await pairedPage.mouse.click(8, 8);
  await expect(settings).not.toBeAttached();
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  await expect(open).toBeFocused();
});

test('reviewing archive deletions keeps Close returning to the worktree', async ({
  pairedPage,
}) => {
  await pairedPage.setViewportSize({ width: 1440, height: 900 });
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  const reviewUrl = pairedPage.url();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await settings
    .getByRole('button', { name: 'Changes & Git', exact: true })
    .click();
  await settings
    .getByRole('link', { name: 'Review archive deletions', exact: true })
    .click();
  await expect(
    settings.getByRole('switch', { name: 'Delete remote branch', exact: true }),
  ).toBeInViewport();
  await closeSettings(pairedPage);
  await expect(pairedPage).toHaveURL(reviewUrl);
  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
});

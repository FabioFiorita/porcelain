import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('Settings opens as its own page with one section at a time, and Back returns to the review', async ({
  pairedPage,
}) => {
  const review = pairedPage.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect(review).toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await expect(settings).toBeVisible();
  await expect(review).not.toBeAttached();
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'General', exact: true }).click();
  await expect(
    settings.getByText('Diff layout', { exact: true }),
  ).toBeVisible();

  await settings
    .getByRole('button', { name: 'Reviews & Git', exact: true })
    .click();
  await expect(
    settings.getByRole('heading', { name: 'Reviews & Git', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('Diff layout', { exact: true }),
  ).not.toBeAttached();

  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).not.toBeAttached();
  await expect(review).toBeVisible();
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
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await openThisComputer(pairedPage);
  const name = settings.getByRole('textbox', {
    name: 'Name of this computer',
    exact: true,
  });
  await name.click();
  await page.keyboard.press('Escape');
  await expect(settings).toBeVisible();

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
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: project.name, exact: true })
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
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    pairedPage.getByText('Worktree not found', { exact: true }),
  ).toBeVisible();
});

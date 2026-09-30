import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('Settings opens as its own page with one section at a time, and Back returns to the review', async ({
  pairedPage,
}) => {
  const review = pairedPage.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect.element(review).toBeVisible();
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
  await expect.element(settings).toBeVisible();
  await expect.element(review).not.toBeInTheDocument();
  await expect
    .element(settings.getByRole('heading', { name: 'Appearance', exact: true }))
    .toBeVisible();
  await expect
    .element(settings.getByText('Diff layout', { exact: true }))
    .toBeVisible();

  await settings
    .getByRole('button', { name: 'Git and agents', exact: true })
    .click();
  await expect
    .element(
      settings.getByRole('heading', { name: 'Git and agents', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(settings.getByText('Diff layout', { exact: true }))
    .not.toBeInTheDocument();

  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.element(settings).not.toBeInTheDocument();
  await expect.element(review).toBeVisible();
});

test('Escape leaves Settings, except while typing in one of its fields', async ({
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
  await settings.getByRole('button', { name: 'Sharing', exact: true }).click();
  const name = settings.getByRole('textbox', {
    name: 'Name of this computer',
    exact: true,
  });
  await name.click();
  await userEvent.keyboard('{Escape}');
  await expect.element(settings).toBeVisible();

  await settings.getByRole('button', { name: 'Updates', exact: true }).click();
  await userEvent.keyboard('{Escape}');
  await expect.element(settings).not.toBeInTheDocument();
  await expect
    .element(
      pairedPage.getByRole('region', { name: 'Review content', exact: true }),
    )
    .toBeVisible();
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
    .getByRole('button', { name: project.name, exact: true })
    .click({ button: 'right' });
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
  await expect
    .element(pairedPage.getByText('No projects registered', { exact: true }))
    .toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await expect
    .element(settings.getByRole('heading', { name: 'Appearance', exact: true }))
    .toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect
    .element(pairedPage.getByText('Select a worktree', { exact: true }))
    .toBeVisible();
}, 30_000);

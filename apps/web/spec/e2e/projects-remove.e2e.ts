import { expect, test } from './fixtures.ts';

test('cancelling the removal of a project keeps it in the navigator and on the server', async ({
  pairedPage,
  server,
}) => {
  const project = await server.project();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const projectButton = pairedPage.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await expect(projectButton).toBeVisible();
  await projectButton.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  const confirm = pairedPage.getByRole('alertdialog', {
    name: `Remove ${project.name} from Porcelain?`,
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(confirm).not.toBeAttached();
  await expect(projectButton).toBeVisible();
  await expect
    .poll(async () =>
      (await server.inventory()).projects.map((entry) => entry.id),
    )
    .toContain(project.id);
});

test('removing a project takes it out of the navigator and the server forgets it', async ({
  pairedPage,
  server,
}) => {
  const project = await server.project();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const projectButton = pairedPage.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await projectButton.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  const confirm = pairedPage.getByRole('alertdialog', {
    name: `Remove ${project.name} from Porcelain?`,
    exact: true,
  });
  await confirm
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();

  await expect(confirm).not.toBeAttached();
  await expect(
    pairedPage.getByText('No projects registered', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await server.inventory()).projects.map((entry) => entry.id),
    )
    .not.toContain(project.id);
});

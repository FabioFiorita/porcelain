import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('the owner names this computer in Settings, and the header, the tab title and pairing show the name', async ({
  pairedPage,
  app,
  server,
}) => {
  const host = (await server.inventory()).environment.name;
  const project = (await server.project()).name;
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  await expect
    .element(navigator.getByText(host, { exact: true }))
    .toBeVisible();

  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  const name = settings.getByRole('textbox', { name: 'Name of this computer' });
  const save = settings.getByRole('button', { name: 'Save' });
  await expect.element(name).toHaveValue('');
  await expect.element(save).toBeDisabled();
  await name.fill('Workstation');
  await save.click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: 'Workstation', custom: true });
  await expect
    .element(settings.getByText(/to connect it to Workstation\./))
    .toBeVisible();
  await expect.element(save).toBeDisabled();
  await expect
    .poll(() => app.title())
    .toBe(`Changes — ${project} · Workstation`);

  await name.fill('');
  await save.click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: host, custom: false });
  await expect.poll(() => app.title()).toBe(`Changes — ${project}`);
  await userEvent.keyboard('{Escape}');
  await expect
    .element(navigator.getByText(host, { exact: true }))
    .toBeVisible();
});

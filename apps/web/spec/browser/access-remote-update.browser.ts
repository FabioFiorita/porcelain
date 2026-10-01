import { expect } from 'vitest';
import { test } from '../kit/journey';

test('This computer lists each remote computer’s update, tells an untrusted app how to get trusted there, and lets a trusted app start the update on that computer', async ({
  pairedPage,
  app,
  remote,
}) => {
  const other = (await remote.server.inventory()).environment.name;
  const offered = await remote.server.serviceUpdate();
  const to = offered.latest ?? '';
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
  const add = async (link: string) => {
    await settings
      .getByRole('button', { name: 'Remote computers', exact: true })
      .click();
    await settings
      .getByRole('textbox', { name: 'Pairing link', exact: true })
      .fill(link);
    await settings.getByRole('button', { name: 'Add', exact: true }).click();
    await expect
      .element(
        settings
          .getByRole('list', { name: 'Remote computers', exact: true })
          .getByRole('listitem', { name: other, exact: true }),
      )
      .toBeVisible();
    await settings
      .getByRole('button', { name: 'This computer', exact: true })
      .click();
  };
  const row = settings
    .getByRole('list', { name: 'Remote computer updates', exact: true })
    .getByRole('listitem', { name: other, exact: true });

  await add(await app.remoteLink());
  await expect
    .element(
      row.getByText(
        new RegExp(
          `^Trust this app on ${other} to update it from here: run porcelain trust \\S+ there\\.$`,
        ),
      ),
    )
    .toBeVisible();
  await expect
    .element(row.getByRole('button', { name: `Update to ${to}`, exact: true }))
    .not.toBeInTheDocument();

  await add(await app.remoteLink('remote', { trusted: true }));
  await row
    .getByRole('button', { name: `Update to ${to}`, exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await remote.server.serviceUpdate();
      return state.running || state.last !== undefined;
    })
    .toBe(true);
}, 30_000);

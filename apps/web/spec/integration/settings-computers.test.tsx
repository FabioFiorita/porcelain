import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const name = 'documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity';

test.for([414, 1080, 1440])(
  'a long computer name fits its card and remains accessible at width %s',
  async (width, { render, reviewLayout }) => {
    await page.viewport(width, 896);
    try {
      const app = await render.route('/settings/computers/this-computer');
      const rename = app.page.getByRole('button', {
        name: 'Rename',
        exact: true,
      });
      await rename.click();
      const field = app.page.getByRole('textbox', {
        name: 'Name of this computer',
        exact: true,
      });
      await field.fill(name);
      await app.page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.element(field).not.toBeInTheDocument();
      const heading = app.page.getByRole('heading', {
        name: `Computers. ${name}`,
        exact: true,
      });
      await expect.element(heading).toBeVisible();
      await expect
        .poll(() => reviewLayout.fitsViewport(heading))
        .toEqual({ insideViewport: true, contentFits: true });
      await app.navigate('/settings/computers');
      const list = app.page.getByRole('region', {
        name: 'Computers list',
        exact: true,
      });
      const open = list.getByRole('button', {
        name: `Open This computer: ${name}`,
        exact: true,
      });
      await expect.element(open).toBeVisible();
      await expect
        .poll(() => reviewLayout.fitsViewport(list))
        .toEqual({ insideViewport: true, contentFits: true });
      await expect
        .element(
          list.getByRole('listitem', {
            name: `This computer: ${name}`,
            exact: true,
          }),
        )
        .toBeVisible();
      reviewLayout.focus(open);
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
      await expect
        .element(app.page.getByRole('dialog', { name: 'Sidebar', exact: true }))
        .not.toBeInTheDocument();
      await expect.element(open).toHaveFocus();
      await expect
        .element(app.page.getByRole('tooltip'))
        .toHaveTextContent(name);
      await open.click();
      await rename.click();
      await expect.element(field).toHaveValue(name);
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test.for([414, 1080, 1440])(
  'a saved computer detail contains its long name and exposes it on keyboard focus at width %s',
  async (width, { render, reviewLayout, remote }) => {
    await page.viewport(width, 896);
    try {
      const remoteName =
        'RemoteComputerAcknowledgementWithoutAnyBreakOpportunity'.padEnd(
          63,
          'X',
        );
      await remote.rename(remoteName);
      const link = await remote.pairingLink();
      const app = await render.route('/settings/computers');
      await app.page
        .getByRole('textbox', { name: 'Pairing link', exact: true })
        .fill(link);
      await app.page.getByRole('button', { name: 'Add', exact: true }).click();
      const open = app.page.getByRole('button', {
        name: `Open ${remoteName}`,
        exact: true,
      });
      await expect.element(open).toBeVisible();
      await open.click();
      const overview = app.page.getByRole('group', {
        name: 'Overview',
        exact: true,
      });
      await expect.element(overview).toBeVisible();
      await expect
        .poll(() => reviewLayout.fitsViewport(overview))
        .toEqual({ insideViewport: true, contentFits: true });
      await expect
        .poll(() =>
          reviewLayout.fitsViewport(
            app.page.getByRole('main', { name: 'Settings', exact: true }),
          ),
        )
        .toEqual({ insideViewport: true, contentFits: true });
      const breadcrumb = app.page
        .getByRole('navigation', { name: 'breadcrumb', exact: true })
        .getByLabelText(remoteName, { exact: true });
      await expect.element(breadcrumb).toHaveAccessibleName(remoteName);
      if (width > 414)
        await expect.element(breadcrumb).not.toHaveAttribute('tabindex');
      else {
        reviewLayout.focus(breadcrumb);
        await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
        await expect.element(breadcrumb).toHaveFocus();
        await expect
          .element(app.page.getByRole('tooltip'))
          .toHaveTextContent(remoteName);
      }
      if (width === 414)
        await app.page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await app.page
        .getByRole('button', { name: 'Close Settings', exact: true })
        .click();
      await expect.element(open).toHaveFocus();
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test('the rename field closes on Save, Cancel and Escape and gives focus back to Rename', async ({
  render,
}) => {
  const app = await render.route('/settings/computers/this-computer');
  const rename = app.page.getByRole('button', { name: 'Rename', exact: true });
  const field = app.page.getByRole('textbox', {
    name: 'Name of this computer',
    exact: true,
  });

  await rename.click();
  await expect.element(field).toHaveFocus();
  await app.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.element(field).not.toBeInTheDocument();
  await expect.element(rename).toHaveFocus();

  await rename.click();
  await field.fill('Escape draft');
  await userEvent.keyboard('{Escape}');
  await expect.element(field).not.toBeInTheDocument();
  await expect.element(rename).toHaveFocus();
  await expect
    .element(app.page.getByRole('main', { name: 'Settings', exact: true }))
    .toBeVisible();

  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'Computers. Escape draft',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();

  await rename.click();
  await field.fill('Studio');
  await app.page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'Computers. Studio',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(field).not.toBeInTheDocument();
  await expect.element(rename).toHaveFocus();
});

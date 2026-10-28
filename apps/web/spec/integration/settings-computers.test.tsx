import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const name = 'documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity';

test.for([414, 1080, 1440])(
  'a long computer name fits its card and remains accessible at width %s',
  async (width, { render, reviewLayout }) => {
    await page.viewport(width, 896);
    try {
      const app = await render.route('/settings/computers/this-computer');
      await app.page
        .getByRole('textbox', { name: 'Name of this computer', exact: true })
        .fill(name);
      const save = app.page.getByRole('button', { name: 'Save', exact: true });
      await save.click();
      await expect.element(save).toBeDisabled();
      const description = app.page.getByText(
        `Open the link or scan the code on the other device to connect it to ${name}. Each link works once, for a few minutes.`,
        { exact: true },
      );
      await expect.element(description).toBeVisible();
      await expect
        .poll(() => reviewLayout.fitsViewport(description))
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
      await expect.element(open).toHaveFocus();
      if (width === 1440)
        await expect
          .element(app.page.getByRole('tooltip'))
          .not.toBeInTheDocument();
      else
        await expect
          .element(app.page.getByRole('tooltip'))
          .toHaveTextContent(name);
      await open.click();
      await expect
        .element(
          app.page.getByRole('textbox', {
            name: 'Name of this computer',
            exact: true,
          }),
        )
        .toHaveValue(name);
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
      if (width !== 414) {
        await expect.element(breadcrumb).not.toHaveAttribute('tabindex');
        await expect
          .poll(() => reviewLayout.fitsViewport(breadcrumb))
          .toEqual({ insideViewport: true, contentFits: true });
      } else {
        reviewLayout.focus(breadcrumb);
        await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
        await expect.element(breadcrumb).toHaveFocus();
        await expect
          .element(app.page.getByRole('tooltip'))
          .toHaveTextContent(remoteName);
      }
      await app.page
        .getByRole('button', { name: 'Close Settings', exact: true })
        .click();
      await expect.element(open).toHaveFocus();
    } finally {
      await page.viewport(414, 896);
    }
  },
);

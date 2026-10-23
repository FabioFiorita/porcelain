import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const name =
  'Workstation documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity';

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
      await app.navigate('/settings/computers');
      const list = app.page.getByRole('region', {
        name: 'Computers list',
        exact: true,
      });
      const open = list.getByRole('button', {
        name: 'Open This computer',
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
      await userEvent.hover(open);
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

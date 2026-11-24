import { userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test('a blocked Git menu item says its printed reason once and its tooltip only describes the action', async ({
  workspace,
}) => {
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  const pull = workspace.getByRole('menuitem', { name: /^Pull/ });
  await expect.element(pull).toHaveAttribute('aria-disabled', 'true');
  await expect
    .element(
      pull.getByText('No upstream branch to pull from.', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(pull)
    .toHaveAccessibleName('Pull No upstream branch to pull from.');

  await userEvent.hover(pull);
  const tooltip = workspace.getByRole('tooltip');
  await expect.element(tooltip).toHaveTextContent('Bring in upstream changes');
  await expect.element(tooltip).not.toHaveTextContent('No upstream branch');
  await expect
    .element(pull)
    .toHaveAccessibleDescription('Bring in upstream changes');
});

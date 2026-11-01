import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('the proof an agent published shows its checks and screenshot, with the failing check first', async ({
  workspace,
  agent,
}) => {
  const output = 'Expected the Saved notice to be visible';
  await agent.publishProof('Readme layer', {
    checks: [
      { name: 'Unit tests', result: 'pass' },
      { name: 'Save journey', result: 'fail', output },
    ],
    screenshot: 'Saved notice',
  });
  await workspace
    .getByRole('button', { name: 'Continue at decision 1', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: '1 of 2 checks failing', exact: true })
    .click();

  const proof = workspace.getByRole('region', { name: /^Proven at / });
  await expect
    .element(proof.getByRole('alert'))
    .toMatchTextContent('1 check failed');
  const checks = proof
    .getByRole('region', { name: 'Checks', exact: true })
    .getByRole('listitem');
  await expect
    .element(checks.first())
    .toHaveAccessibleName('Save journey: Failed');
  await expect.element(checks.first()).toMatchTextContent(output);
  await expect
    .element(checks.nth(1))
    .toHaveAccessibleName('Unit tests: Passed');
  await expect
    .element(proof.getByRole('img', { name: 'Saved notice', exact: true }))
    .toBeVisible();
  const enlarge = proof.getByRole('button', {
    name: 'Enlarge Saved notice',
    exact: true,
  });
  await enlarge.click();
  const image = page.getByRole('dialog', { name: 'Saved notice', exact: true });
  await expect
    .element(image.getByRole('img', { name: 'Saved notice', exact: true }))
    .toBeVisible();
  await expect
    .element(
      image.getByRole('button', { name: 'View original size', exact: true }),
    )
    .toBeVisible();
  await image
    .getByRole('button', { name: 'View original size', exact: true })
    .click();
  await image.getByRole('button', { name: 'Fit image', exact: true }).click();
  await userEvent.keyboard('{Escape}');
  await expect.element(image).not.toBeInTheDocument();
  await expect.element(enlarge).toHaveFocus();
});

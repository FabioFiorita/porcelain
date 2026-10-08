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
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Proof · 1 failing', exact: true })
    .click();

  const proof = workspace.getByRole('region', { name: 'Proof', exact: true });
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
});

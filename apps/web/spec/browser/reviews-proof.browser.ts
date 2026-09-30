import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the proof an agent published shows its checks and screenshot, with the failing check first', async ({
  pairedPage,
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
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: 'Proof · 1 failing', exact: true })
    .click();

  const proof = pairedPage.getByRole('region', { name: 'Proof', exact: true });
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

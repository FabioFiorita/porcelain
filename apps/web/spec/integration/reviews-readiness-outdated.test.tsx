import { expect, test } from './fixtures.tsx';

test('an agent question and checks older than the code keep the readiness panel from clearing', async ({
  workspace,
  repo,
  agent,
}) => {
  const readme = repo.readme.path;
  const readiness = workspace
    .getByRole('dialog')
    .getByRole('region', { name: 'Readiness', exact: true });
  const line = (text: string) =>
    readiness.getByRole('button', { name: text, exact: true });

  await agent.publishProof('Readme layer', {
    checks: [
      { name: 'Unit tests', result: 'pass' },
      { name: 'Save journey', result: 'pass' },
    ],
    screenshot: 'Saved notice',
  });
  await agent.comment(readme, 'Should the note mention the new flag?');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect.element(line('2 checks passed')).toBeVisible();
  await expect.element(line('1 comment waiting on you')).toBeVisible();

  await repo.write(readme, `${repo.readme.changed}Another line.\n`);
  await expect
    .element(line('Checks ran before the latest changes'))
    .toBeVisible();
  await line('Checks ran before the latest changes').click();
  const proof = workspace.getByRole('region', { name: 'Proof', exact: true });
  await expect
    .element(
      proof.getByText('These checks ran before the latest changes', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(proof.getByRole('heading', { name: 'Proof', exact: true }))
    .toBeVisible();
  await expect.element(proof).toMatchTextContent('Published ');
});

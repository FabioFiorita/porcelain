import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('the readiness panel follows reviewed and stale files, unexplained lines, waiting comments and failing checks', async ({
  pairedPage,
  repo,
  agent,
}) => {
  const readme = repo.readme.path;
  const sidebar = pairedPage.getByRole('dialog');
  const readiness = sidebar.getByRole('region', {
    name: 'Readiness',
    exact: true,
  });
  const line = (text: string) =>
    readiness.getByRole('button', { name: text, exact: true });
  const showReadiness = () =>
    pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  const hideReadiness = async () => {
    await userEvent.keyboard('{Escape}');
    await expect.element(sidebar).not.toBeInTheDocument();
  };

  await showReadiness();
  await expect.element(line('0 of 1 file reviewed')).toBeVisible();
  await expect.element(line('No marks went stale')).toBeVisible();
  await expect.element(line('No review published')).toBeVisible();
  await expect.element(line('No open comments')).toBeVisible();
  await expect.element(line('No checks attached')).toBeVisible();
  await hideReadiness();

  await pairedPage
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await pairedPage
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Why?');
  await pairedPage
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('Waiting for the agent', { exact: true }))
    .toBeVisible();
  await pairedPage
    .getByRole('button', { name: `Mark ${readme} as reviewed`, exact: true })
    .click();
  await expect
    .element(
      pairedPage.getByRole('button', {
        name: `Unmark ${readme} as unreviewed`,
        exact: true,
      }),
    )
    .toBeEnabled();
  await showReadiness();
  await expect.element(line('1 comment waiting on the agent')).toBeVisible();
  await expect.element(line('1 of 1 file reviewed')).toBeVisible();

  await repo.write(readme, `${repo.readme.changed}Another line.\n`);
  await expect.element(line('1 mark changed since reviewed')).toBeVisible();
  await expect.element(line('0 of 1 file reviewed')).toBeVisible();

  await repo.write('notes.md', 'A note the review leaves out.\n');
  await expect.element(line('0 of 2 files reviewed')).toBeVisible();
  await agent.publishProof('Readme layer', {
    checks: [
      { name: 'Unit tests', result: 'pass' },
      { name: 'Save journey', result: 'fail' },
    ],
    screenshot: 'Saved notice',
  });
  await expect.element(line('1 line in 1 file not explained')).toBeVisible();
  await expect.element(line('1 of 2 checks failing')).toBeVisible();
  await expect
    .element(readiness.getByRole('button', { name: /^Readiness/ }))
    .toMatchTextContent('5 things to check');

  await line('1 of 2 checks failing').click();
  await expect
    .element(
      pairedPage
        .getByRole('region', { name: 'Proof', exact: true })
        .getByRole('heading', { name: 'Proof', exact: true }),
    )
    .toBeVisible();
});

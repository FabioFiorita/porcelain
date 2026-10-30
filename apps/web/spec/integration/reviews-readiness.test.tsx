import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('the readiness panel follows reviewed and stale files, waiting comments and failing checks, and keeps the published review to checks, proof, decisions and comments', async ({
  workspace,
  repo,
  agent,
  server,
}) => {
  const readme = repo.readme.path;
  const sidebar = workspace.getByRole('dialog');
  const readiness = sidebar.getByRole('region', {
    name: 'Readiness',
    exact: true,
  });
  const line = (text: string) =>
    readiness.getByRole('button', { name: text, exact: true });
  const showReadiness = async () => {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace
      .getByRole('complementary', { name: 'Review sidebar', exact: true })
      .getByRole('tab', { name: 'Changes', exact: true })
      .click();
  };
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

  await workspace
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await workspace
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Why?');
  await workspace.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .element(workspace.getByText('Waiting for the agent', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: `Mark ${readme} as reviewed`, exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('button', {
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
  await expect(
    server.publishedReview().then(({ review }) => review?.notExplained),
  ).resolves.toEqual([
    { path: readme, ranges: [{ startLine: 4, endLine: 4 }] },
    { path: 'notes.md', ranges: [{ startLine: 1, endLine: 1 }] },
  ]);
  await expect.element(line('1 of 2 checks failing')).toBeVisible();
  await expect.element(line('Proof is incomplete')).toBeVisible();
  await expect.element(line('0 of 1 decision reviewed')).toBeVisible();
  await expect.element(line('1 comment waiting on the agent')).toBeVisible();
  await expect
    .element(line('2 lines in 2 files not explained'))
    .not.toBeInTheDocument();
  await expect
    .element(
      sidebar
        .getByRole('navigation', { name: 'Walkthrough', exact: true })
        .getByRole('button', { name: 'Not explained', exact: true }),
    )
    .toBeVisible();

  await line('1 of 2 checks failing').click();
  await expect
    .element(
      workspace
        .getByRole('region', { name: /^Proven at / })
        .getByRole('heading', { name: /^Proven at / }),
    )
    .toBeVisible();
});

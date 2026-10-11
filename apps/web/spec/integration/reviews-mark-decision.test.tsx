import { expect, test } from './fixtures.tsx';

test('marking a decision reviews its unreviewed files and records the decision, a change to its code reopens it, and unmarking keeps the files', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const title = 'Readme layer';
  const readme = repo.readme.path;
  const files = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  const decisions = async () =>
    (await server.reviewedLayers()).marks.map((mark) =>
      mark.stale ? 'stale' : 'reviewed',
    );
  await agent.publishReview(title);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp(title) }).click();
  const decision = workspace.getByRole('region', {
    name: `1. ${title}`,
    exact: true,
  });

  const markFile = decision.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  await markFile.click();
  await expect.poll(files).toEqual([readme]);
  await expect.poll(decisions).toEqual([]);
  await decision
    .getByRole('button', {
      name: `Unmark ${readme} as unreviewed`,
      exact: true,
    })
    .click();
  await expect.poll(files).toEqual([]);
  const mark = decision.getByRole('button', {
    name: 'Mark decision reviewed',
    exact: true,
  });
  const reviewed = decision.getByRole('button', {
    name: 'Decision reviewed',
    exact: true,
  });
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(files).toEqual([readme]);
  await expect.poll(decisions).toEqual(['reviewed']);

  await repo.write(readme, `${repo.readme.committed}\nA revised change.\n`);
  await expect
    .element(
      decision.getByText('Code moved since it was explained', { exact: true }),
    )
    .toBeVisible();
  await expect.poll(decisions).toEqual(['stale']);
  await expect.element(mark).toBeEnabled();
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(decisions).toEqual(['reviewed']);
  await expect.poll(files).toEqual([readme]);

  await reviewed.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(decisions).toEqual([]);
  await expect.poll(files).toEqual([readme]);
});

test('marking a decision whose files are already reviewed keeps their marks', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const title = 'Readme layer';
  const readme = repo.readme.path;
  const files = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  await agent.publishReview(title);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp(title) }).click();
  const decision = workspace.getByRole('region', {
    name: `1. ${title}`,
    exact: true,
  });
  await decision
    .getByRole('button', {
      name: `Mark ${readme} as reviewed`,
      exact: true,
    })
    .click();
  await expect.poll(files).toEqual([readme]);
  await decision
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedLayers()).marks.map((mark) => mark.stale),
    )
    .toEqual([false]);
  await expect.poll(files).toEqual([readme]);
  await expect
    .element(
      decision.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
});

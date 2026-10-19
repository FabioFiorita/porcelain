import { expect, test } from './fixtures.tsx';

const unavailable =
  'large-sample.txt cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable). This stop stays open until every file can be marked reviewed.';

test('an unexplained stop marks only available files, explains the open remainder and blocks a futile repeat', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  await agent.publishReview('Readable decision');
  for (const name of ['a', 'b', 'c'])
    await repo.write(`${name}.ts`, `export const ${name} = true;\n`);
  await repo.write('large-sample.txt', 'x'.repeat(66 * 1024 * 1024));
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('navigation', { name: 'Walkthrough', exact: true })
    .getByRole('button', { name: /^Not explained ·/ })
    .click();
  const stop = workspace.getByRole('region', {
    name: 'Not explained',
    exact: true,
  });
  await expect
    .element(
      stop.getByText(
        `Marks the 3 available files here reviewed. ${unavailable}`,
        { exact: true },
      ),
    )
    .toBeVisible();
  const marker = stop.getByText('Not reviewable: too large or unreadable', {
    exact: true,
  });
  await expect.element(marker).toBeVisible();
  await expect
    .element(marker)
    .toHaveAttribute(
      'title',
      'large-sample.txt cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable).',
    );
  await stop
    .getByRole('button', { name: 'Mark available files reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual(['a.ts', 'b.ts', 'c.ts']);
  await expect
    .poll(async () => (await server.reviewedLayers()).marks)
    .toEqual([]);
  await expect
    .element(stop.getByText(unavailable, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByText('Some files cannot be marked reviewed', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      stop.getByRole('button', { name: 'Review unavailable', exact: true }),
    )
    .toBeDisabled();
  await repo.remove('large-sample.txt');
  await expect
    .element(
      stop.getByRole('button', { name: 'Back to the briefing', exact: true }),
    )
    .toBeEnabled();
});

test('an authored decision with an unavailable file blocks toolbar, closing and sidebar completion and recovers when readable', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  await agent.publishReview('Cap decision');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: /1 Cap decision/ }).click();
  const stop = workspace.getByRole('region', {
    name: '1. Cap decision',
    exact: true,
  });
  await stop
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedLayers()).marks.map((mark) => mark.stale),
    )
    .toEqual([false]);
  await stop
    .getByRole('button', { name: 'Decision reviewed', exact: true })
    .click();
  await repo.write(repo.readme.path, 'x'.repeat(66 * 1024 * 1024));
  await expect
    .element(
      stop
        .getByRole('button', { name: 'Review unavailable', exact: true })
        .first(),
    )
    .toBeDisabled();
  await expect
    .element(
      stop
        .getByRole('button', { name: 'Review unavailable', exact: true })
        .last(),
    )
    .toBeDisabled();
  await expect
    .element(
      stop.getByText(
        'README.md cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable). This stop stays open until every file can be marked reviewed.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'More actions for decision 1', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Review unavailable',
        exact: true,
      }),
    )
    .toBeDisabled();
  await workspace.getByRole('menuitem', { name: 'Open', exact: true }).click();
  await expect
    .poll(async () => (await server.reviewedLayers()).marks)
    .toEqual([]);
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual([repo.readme.path]);
  await repo.write(repo.readme.path, repo.readme.changed);
  await expect
    .element(
      stop.getByRole('button', { name: 'Mark decision reviewed', exact: true }),
    )
    .toBeEnabled();
  await stop
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedLayers()).marks.map((mark) => mark.stale),
    )
    .toEqual([false]);
  await expect
    .element(
      stop.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
});

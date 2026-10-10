import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('N and P move between decisions, and file shortcuts act once on the decision being read', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', {
      name: '3 Publish an immutable note 0/6',
      exact: true,
    })
    .click();
  const note = workspace.getByRole('region', {
    name: '3. Publish an immutable note',
    exact: true,
  });
  await expect
    .element(
      note.getByRole('button', {
        name: 'Mark apps/web/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await userEvent.keyboard('n');
  await expect
    .element(
      workspace.getByRole('region', {
        name: '4. Export history without blocking writes',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('p');
  await expect
    .element(
      note.getByRole('button', {
        name: 'Mark apps/web/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await userEvent.keyboard('jr');
  await expect
    .element(
      note.getByRole('button', {
        name: 'Unmark packages/client/src/publish-note.ts as unreviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(
    server
      .reviewedFiles()
      .then(({ marks }) =>
        marks
          .map((mark) => mark.path)
          .filter((path) => path.includes('publish-note')),
      ),
  ).resolves.toEqual(['packages/client/src/publish-note.ts']);
});

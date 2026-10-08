import { expect, test } from './fixtures.tsx';

test('a layer keeps its code locations reachable beside its graph and can read one complete file or all layer changes', async ({
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
    .getByRole('button', { name: '3. Publish an immutable note', exact: true })
    .click();
  const layer = workspace.getByRole('region', {
    name: 'Review layer Publish an immutable note',
    exact: true,
  });
  const explorer = layer.getByRole('complementary', {
    name: 'Explore the layer',
    exact: true,
  });
  await expect
    .element(
      explorer.getByRole('heading', { name: 'Explore the layer', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      layer.getByText(
        '6 changed files · All changes in these files · 1 existing code locations',
        { exact: true },
      ),
    )
    .toBeVisible();
  await explorer
    .getByRole('button', {
      name: 'Explore Prepare a bounded request',
      exact: true,
    })
    .click();
  await expect
    .element(layer.getByRole('tab', { name: 'One file', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  const clientMark = layer.getByRole('button', {
    name: 'Mark packages/client/src/publish-note.ts as reviewed',
    exact: true,
  });
  await expect.element(clientMark).toBeEnabled();
  await expect
    .element(
      layer.getByRole('button', {
        name: 'Mark apps/web/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  const layerMarks = (await server.reviewedLayers()).marks;
  await clientMark.click();
  await expect
    .element(
      layer.getByRole('button', {
        name: 'Unmark packages/client/src/publish-note.ts as unreviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(
    server.reviewedFiles().then(({ marks }) => marks.map((mark) => mark.path)),
  ).resolves.toEqual(['packages/client/src/publish-note.ts']);
  await expect(
    server.reviewedLayers().then(({ marks }) => marks),
  ).resolves.toEqual(layerMarks);
  await explorer
    .getByRole('button', { name: 'Full layer diff', exact: true })
    .click();
  await expect
    .element(layer.getByRole('tab', { name: 'All files', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      layer.getByRole('button', {
        name: 'Mark apps/web/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await layer.getByRole('tab', { name: 'Graph', exact: true }).click();
  await expect
    .element(
      explorer.getByRole('button', {
        name: 'Explore Authorize and persist the outcome',
        exact: true,
      }),
    )
    .toBeVisible();
  await explorer
    .getByRole('button', {
      name: 'Explore Authorize and persist the outcome',
      exact: true,
    })
    .click();
  const code = workspace.getByRole('dialog', {
    name: 'Authorize and persist the outcome',
    exact: true,
  });
  await expect.element(code).toBeVisible();
  await expect
    .element(
      code.getByRole('button', {
        name: 'Mark apps/server/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect
    .element(
      code.getByRole('button', {
        name: 'Mark packages/client/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await code.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.element(code).not.toBeInTheDocument();
  await expect
    .element(layer.getByRole('tab', { name: 'Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      layer.getByRole('button', {
        name: 'Authorize and persist the outcome',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect.element(explorer.getByRole('code')).not.toBeInTheDocument();
  await explorer
    .getByRole('button', {
      name: 'Explore Reuse the workspace actor',
      exact: true,
    })
    .click();
  const context = workspace.getByRole('dialog', {
    name: 'Reuse the workspace actor',
    exact: true,
  });
  await expect
    .element(
      context.getByText(
        'Source excerpts outside the current changed-file set.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect
    .element(context.getByRole('button', { name: /Mark .* as reviewed/ }))
    .not.toBeInTheDocument();
  await context.getByRole('button', { name: 'Close', exact: true }).click();
  await expect
    .element(layer.getByRole('tab', { name: 'Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await layer.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect
    .element(layer.getByRole('tab', { name: 'One file', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

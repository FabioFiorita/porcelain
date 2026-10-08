import { expect, test } from './fixtures.tsx';

test('a layer keeps its code locations reachable beside its graph and can read one complete file or all layer changes', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
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
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual(['packages/client/src/publish-note.ts']);
  await expect
    .poll(async () => (await server.reviewedLayers()).marks)
    .toEqual(layerMarks);
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
  const excerpt = layer.getByRole('region', {
    name: 'Selected step code',
    exact: true,
  });
  await expect
    .element(
      excerpt.getByText('Changed code · Excerpt · Lines 1–10', { exact: true }),
    )
    .toBeVisible();
  await excerpt
    .getByRole('button', { name: 'Close code', exact: true })
    .click();
  await expect.element(excerpt).not.toBeInTheDocument();
  await expect
    .element(
      explorer.getByRole('button', { name: 'Full layer diff', exact: true }),
    )
    .toBeVisible();
  await explorer
    .getByRole('button', {
      name: 'Explore Authorize and persist the outcome',
      exact: true,
    })
    .click();
  await excerpt
    .getByRole('button', { name: 'Read full file diff', exact: true })
    .click();
  await expect
    .element(layer.getByRole('tab', { name: 'Code', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      layer.getByRole('button', {
        name: 'Mark apps/server/src/publish-note.ts as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect.element(clientMark).not.toBeInTheDocument();
  await explorer
    .getByRole('button', {
      name: 'Explore Reuse the workspace actor',
      exact: true,
    })
    .click();
  await expect
    .element(
      layer.getByText('Source excerpts outside the current changed-file set.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(layer.getByRole('button', { name: /Mark .* as reviewed/ }))
    .not.toBeInTheDocument();
});

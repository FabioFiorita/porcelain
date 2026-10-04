import { expect, test } from './fixtures.tsx';

test('a Files text conflict refreshes its lists once and keeps following live invalidation', async ({
  render,
  fetchGate,
  repo,
  live,
}) => {
  const path = 'recovery.txt';
  await repo.write(path, 'Before the conflict\n');
  await repo.commit('Add a file to recover');
  const conflict = fetchGate.failNextFileRead('/text');
  const heldInventory = fetchGate.holdNextRead('/inventory');
  const opened = await render.workspace();
  await expect.poll(() => live.connected()).toBe(true);
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect
    .element(opened.getByRole('treeitem', { name: path, exact: true }))
    .toBeVisible();
  conflict.arm();
  heldInventory.arm();
  await opened.getByRole('treeitem', { name: path, exact: true }).click();
  await heldInventory.requested;
  heldInventory.release();
  await expect
    .element(opened.getByText('Before the conflict', { exact: true }))
    .toBeVisible();
  await expect
    .poll(() =>
      conflict
        .responses()
        .filter((response) => response.path.endsWith('/text'))
        .map((response) => response.status),
    )
    .toEqual([409, 200]);
  await expect
    .poll(() =>
      conflict
        .responses()
        .filter((response) => response.path.endsWith('/inventory'))
        .map((response) => response.status),
    )
    .toEqual([200]);
  await expect
    .poll(() =>
      conflict
        .responses()
        .filter((response) => response.path.endsWith('/directory'))
        .map((response) => response.status),
    )
    .toContain(200);
  await expect
    .poll(() =>
      conflict
        .responses()
        .filter((response) => response.path.endsWith('/paths'))
        .map((response) => response.status),
    )
    .toContain(200);
  await repo.write(path, 'A later live update still arrives\n');
  await expect
    .element(
      opened.getByText('A later live update still arrives', { exact: true }),
    )
    .toBeVisible();
  await expect
    .poll(() =>
      conflict
        .responses()
        .filter((response) => response.path.endsWith('/text'))
        .map((response) => response.status),
    )
    .toEqual([409, 200, 200]);
});

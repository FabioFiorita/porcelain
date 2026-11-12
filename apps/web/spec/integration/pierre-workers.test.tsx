import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('long files highlight in workers, reuse unchanged revisions and refresh changed contents', async ({
  repo,
  render,
  pierreWorkers: workers,
}) => {
  const path = 'highlighted.ts';
  const contents = Array.from(
    { length: 1500 },
    (_, index) => `export const value${index} = 'original ${index}';`,
  ).join('\n');
  await repo.write(path, contents);
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  const code = workspace.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  await expect
    .element(
      code.getByText("export const value0 = 'original 0';", { exact: true }),
    )
    .toBeVisible();
  const files = () => workers.files(path);
  await expect.poll(() => files().length).toBeGreaterThan(0);
  await expect.poll(() => workers.cached(path)).toBe(true);
  const request = files().at(-1);
  await expect.poll(() => request?.file.cacheKey).toBeDefined();
  await expect
    .poll(() => workers.responseFor(request))
    .toMatchObject({ options: { theme: 'porcelain-review' } });
  const rendered = files().map((request) => ({
    key: request.file.cacheKey,
    length: request.file.contents.length,
    origin: workers.originFor(request),
  }));
  await workspace
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  await workspace.getByRole('tab', { name: path, exact: true }).click();
  await expect
    .element(
      code.getByText("export const value0 = 'original 0';", { exact: true }),
    )
    .toBeVisible();
  await expect
    .poll(() =>
      files().map((request) => ({
        key: request.file.cacheKey,
        length: request.file.contents.length,
        origin: workers.originFor(request),
      })),
    )
    .toEqual(rendered);
  await repo.write(path, contents.replace('original 0', 'changed 0'));
  await expect
    .element(
      code.getByText("export const value0 = 'changed 0';", { exact: true }),
    )
    .toBeVisible();
  await expect.poll(() => files().at(-1)?.file.contents).toContain('changed 0');
  await expect
    .poll(() => files().at(-1)?.file.cacheKey)
    .not.toBe(request?.file.cacheKey);
  await expect
    .poll(() =>
      workers.responses().filter((response) => response.type === 'error'),
    )
    .toEqual([]);
});

test('simultaneous code panes preserve their palettes and release every worker on unmount', async ({
  pierreWorkers: workers,
  pierrePanes: panes,
}) => {
  for (const mount of [1, 2]) {
    panes.show();
    await expect
      .element(page.getByText('export const standard = 1;', { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText('export const review = 2;', { exact: true }))
      .toBeVisible();
    const themed = (path: string) => {
      const request = workers.files(path).at(-1);
      return workers.responseFor(request);
    };
    await expect
      .poll(() => themed('standard.ts'))
      .toMatchObject({
        options: { theme: { light: 'pierre-light', dark: 'pierre-dark' } },
      });
    await expect
      .poll(() => themed('review.ts'))
      .toMatchObject({ options: { theme: 'porcelain-review' } });
    await expect
      .poll(() => workers.active(), {
        message: `mounted worker budget on mount ${mount}`,
      })
      .toBe(4);
    panes.hide();
    await expect.poll(() => workers.active()).toBe(0);
  }
  await expect
    .poll(() =>
      workers.responses().filter((response) => response.type === 'error'),
    )
    .toEqual([]);
});

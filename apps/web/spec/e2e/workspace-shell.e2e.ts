import { expect, test } from './fixtures.ts';
import { documentTabIsRevealed } from '../kit/workspace-shell.ts';

for (const preferred of [220, 420]) {
  test(`the navigator keeps a deliberate ${preferred}px width across resize and temporary constraints`, async ({
    pairedPage: page,
  }) => {
    await page.setViewportSize({ width: 3440, height: 900 });
    const navigator = page.getByRole('navigation', {
      name: 'Projects and worktrees',
      exact: true,
    });
    const separator = page.getByRole('separator', {
      name: 'Worktree navigator and document panes',
      exact: true,
    });
    await expect(navigator).toBeVisible();
    const handle = await separator.boundingBox();
    const panel = await navigator.boundingBox();
    if (!handle || !panel)
      throw new Error('Navigator resize handle is missing');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
    await page.mouse.down();
    await page.mouse.move(
      panel.x + preferred + handle.width / 2,
      handle.y + 100,
      {
        steps: 8,
      },
    );
    await page.mouse.up();
    await expect
      .poll(async () => (await navigator.boundingBox())?.width ?? 0)
      .toBeCloseTo(preferred, 0);
    for (const width of [900, 1100, 3440, 800, 3440]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 800 && preferred === 420) {
        await expect
          .poll(async () => (await navigator.boundingBox())?.width ?? 0)
          .toBeLessThan(420);
      } else {
        await expect
          .poll(async () => (await navigator.boundingBox())?.width ?? 0)
          .toBeCloseTo(preferred, 0);
      }
    }
    await separator.focus();
    await separator.press('Home');
    await expect
      .poll(async () => (await navigator.boundingBox())?.width ?? 0)
      .toBeCloseTo(220, 0);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.setViewportSize({ width: 3440, height: 900 });
    await expect
      .poll(async () => (await navigator.boundingBox())?.width ?? 0)
      .toBeCloseTo(220, 0);
  });
}

for (const width of [900, 1100]) {
  test(`crowded document tabs stay reachable through the document menu at ${width}px`, async ({
    pairedPage: page,
    repo,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const paths = [
      'first-document-with-a-long-name.md',
      'second-document-with-a-long-name.md',
      'third-document-with-a-long-name.md',
    ] as const;
    for (const path of paths) {
      await repo.write(path, `# ${path}\n`);
      await page.keyboard.press('ControlOrMeta+p');
      await page
        .getByRole('combobox', { name: 'Find a file by name', exact: true })
        .fill(path);
      await page.getByRole('option', { name: path, exact: true }).click();
      await expect(
        page.getByRole('heading', { name: path, exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: path, exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
    }
    const tabs = page.getByRole('tablist', {
      name: 'Open documents',
      exact: true,
    });
    await tabs.getByRole('tab', { name: 'Review', exact: true }).click();
    const list = page.getByRole('button', {
      name: 'Open document list',
      exact: true,
    });
    await expect(list).toBeVisible();
    await list.click();
    for (const path of paths) {
      await expect(
        page.getByRole('menuitemradio', { name: path, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole('menuitemradio', { name: 'Review', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await page
      .getByRole('menuitemradio', { name: paths[0], exact: true })
      .click();
    const selected = tabs.getByRole('tab', { name: paths[0], exact: true });
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('menu')).not.toBeVisible();
    await expect
      .poll(() => selected.evaluate(documentTabIsRevealed))
      .toBe(true);
    await selected.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin', exact: true }).click();
    await expect(
      selected.getByRole('button', { name: `Unpin ${paths[0]}`, exact: true }),
    ).toBeVisible();
    await list.focus();
    await list.press('ArrowDown');
    const last = page.getByRole('menuitemradio', {
      name: paths[2],
      exact: true,
    });
    await page
      .getByRole('menu', { name: 'Open document list', exact: true })
      .press('End');
    await expect(last).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      tabs.getByRole('tab', { name: paths[2], exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('menu')).not.toBeVisible();
    await tabs
      .getByRole('button', { name: `Close ${paths[2]}`, exact: true })
      .click();
    await expect(
      tabs.getByRole('tab', { name: paths[2], exact: true }),
    ).not.toBeAttached();
    await selected.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Open to the side/ }).click();
    await expect(
      page
        .getByRole('region', { name: 'Right pane', exact: true })
        .getByRole('tab', { name: paths[0], exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
  });
}

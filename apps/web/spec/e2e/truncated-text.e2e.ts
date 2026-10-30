import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`long History subjects reveal their full value on keyboard focus at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      repo,
    }) => {
      const subjects = [
        'Explain the full sequence of decisions the reviewer must understand before approving this exceptionally long change',
        'ACommitSubjectWithoutAnyWordBreaksThatStillNeedsToRemainReadableWhenItIsClippedAtTheEdgeOfTheHistoryPanel',
      ] as const;
      const short = 'Short note';
      for (const subject of [short, ...subjects]) {
        await repo.write('notes.md', `${subject}\n`);
        await repo.commit(subject);
      }
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      if (width === 414) {
        await page.getByRole('button', { name: 'Review', exact: true }).click();
        await page.getByRole('tab', { name: 'History', exact: true }).click();
      } else
        await page
          .getByRole('navigation', { name: 'Side panel', exact: true })
          .getByRole('button', { name: 'History', exact: true })
          .click();
      const history = page.getByRole('complementary', {
        name: 'Review sidebar',
        exact: true,
      });
      const row = (subject: string) =>
        history.getByRole('button', { name: new RegExp(`^${subject}`) });
      for (const subject of subjects) {
        const label = history.getByText(subject, { exact: true });
        await expect(label).not.toHaveAttribute('tabindex');
        const tooltip = page.getByRole('tooltip', {
          name: subject,
          exact: true,
        });
        await row(subject).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(row(subject)).toBeFocused();
        await expect(tooltip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tooltip).not.toBeVisible();
        await expect(row(subject)).toBeFocused();
      }
      const shortLabel = history.getByText(short, { exact: true });
      await expect(shortLabel).not.toHaveAttribute('tabindex');
      await row(short).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(row(short)).toBeFocused();
      await expect(
        page.getByRole('tooltip', { name: short, exact: true }),
      ).toHaveCount(0);
      if (width === 1440) {
        const author = page.getByRole('tooltip', {
          name: 'Porcelain Verification',
          exact: true,
        });
        await expect(author).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(author).not.toBeVisible();
        await expect(row(short)).toBeFocused();
      } else await expect(page.getByRole('tooltip')).toHaveCount(0);
      await row(subjects[0]).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      for (const subject of [subjects[0], short]) {
        await expect(row(subject)).toBeFocused();
        await page.keyboard.press('Tab');
      }
      if (width === 414) {
        const historyTab = page.getByRole('tab', {
          name: 'History',
          exact: true,
        });
        await historyTab.focus();
        await expect(historyTab).toBeFocused();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(history).not.toBeVisible();
        const review = page.getByRole('button', {
          name: 'Review',
          exact: true,
        });
        await expect(review).toBeFocused();
        await review.click();
      }
      await history.getByText(subjects[0], { exact: true }).click();
      await expect(
        page.getByRole('heading', { name: subjects[0], exact: true }),
      ).toBeVisible();
      const documents = page.getByRole('tablist', {
        name: 'Open documents',
        exact: true,
      });
      const commitTab = documents.getByRole('tab', { name: /^[0-9a-f]{7} / });
      for (const key of ['Enter', 'Space']) {
        await documents
          .getByRole('tab', { name: 'Changes', exact: true })
          .click();
        await commitTab.focus();
        await page.keyboard.press(key);
        await expect(commitTab).toHaveAttribute('aria-selected', 'true');
      }
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(commitTab).toBeFocused();
      await expect(
        page.getByRole('tooltip', { name: /^Commit [0-9a-f]{40} · / }),
      ).toBeVisible();
    });
  }
}

for (const width of [1440, 414]) {
  test(`long worktree card labels disclose on keyboard focus at ${width}px`, async ({
    pairedPage: page,
    repo,
    app,
    server,
  }) => {
    const branch =
      'a-long-worktree-branch-whose-full-value-must-be-readable-from-the-keyboard';
    await repo.worktree(branch);
    await app.reload();
    await page.setViewportSize({ width, height: 896 });
    if (width === 414)
      await page
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    const row = page
      .getByRole('navigation', { name: 'Projects and worktrees', exact: true })
      .getByRole('button', { name: new RegExp(branch) });
    await row.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();
    const tooltip = page.getByRole('tooltip', { name: new RegExp(branch) });
    await expect(tooltip).toBeVisible();
    await row.press('Escape');
    await expect(tooltip).not.toBeVisible();
    await expect(row).toBeFocused();
    await row.press('Enter');
    const project = await server.project();
    const target = project.worktrees.find(
      (worktree) => worktree.branch === branch,
    );
    await expect
      .poll(() => app.address().path)
      .toBe(`/${project.id}/${target?.id ?? ''}`);
  });
}

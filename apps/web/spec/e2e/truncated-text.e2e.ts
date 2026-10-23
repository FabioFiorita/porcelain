import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`long History subjects reveal their full value on hover and keyboard focus at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      repo,
    }) => {
      const subjects = [
        'Explain the full sequence of decisions the reviewer must understand before approving this exceptionally long change',
        'ACommitSubjectWithoutAnyWordBreaksThatStillNeedsToRemainReadableWhenItIsClippedAtTheEdgeOfTheHistoryPanel',
      ];
      for (const subject of subjects) {
        await repo.write('notes.md', `${subject}\n`);
        await repo.commit(subject);
      }
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'History', exact: true }).click();
      const history = page.getByRole('complementary', {
        name: 'Review sidebar',
        exact: true,
      });
      for (const subject of subjects) {
        const label = history.getByText(subject, { exact: true });
        await expect(label).toHaveAccessibleName(subject);
        await expect(label).toHaveAttribute('tabindex', '0');
        await label.hover();
        const tooltip = page.getByRole('tooltip', {
          name: subject,
          exact: true,
        });
        await expect(tooltip).toBeVisible();
        await page.mouse.move(1, 1);
        await label.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(label).toBeFocused();
        await expect(tooltip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tooltip).not.toBeVisible();
        await expect(label).toBeFocused();
      }
      await history.getByText(subjects[0], { exact: true }).click();
      await expect(
        page.getByRole('heading', { name: subjects[0], exact: true }),
      ).toBeVisible();
      const documents = page.getByRole('tablist', {
        name: 'Open documents',
        exact: true,
      });
      const commitTab = documents.getByRole('tab', { name: /^[0-9a-f]{7}$/ });
      for (const key of ['Enter', 'Space']) {
        await documents
          .getByRole('tab', { name: 'Changes', exact: true })
          .click();
        await commitTab.getByText(/^[0-9a-f]{7}$/).focus();
        await page.keyboard.press(key);
        await expect(commitTab).toHaveAttribute('aria-selected', 'true');
      }
    });
  }
}

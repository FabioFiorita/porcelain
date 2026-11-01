import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('History and graph retain selection and reading position after leaving them', async ({
  render,
  repo,
  reviewLayout,
}) => {
  await page.viewport(1280, 896);
  try {
    for (let index = 1; index <= 24; index++) {
      await repo.write('notes.md', `Step ${index}\n`);
      await repo.commit(`Write step ${index}`);
    }
    const workspace = await render.workspace();
    const navigation = workspace.getByRole('navigation', {
      name: 'Side panel',
      exact: true,
    });
    await navigation
      .getByRole('button', { name: 'History', exact: true })
      .click();
    const history = workspace.getByRole('region', {
      name: 'History reading area',
      exact: true,
    });
    await expect.element(history).toBeVisible();
    reviewLayout.scrollHistoryToEnd(history);
    await expect
      .element(history.getByText('Start of history.', { exact: true }))
      .toBeInTheDocument();
    const oldest = history.getByRole('button', { name: /^Initial commit / });
    reviewLayout.bringIntoView(oldest);
    await oldest.click();
    await expect
      .poll(() => reviewLayout.historyScrollTop(history))
      .toBeGreaterThan(0);
    const position = reviewLayout.historyScrollTop(history);
    await navigation
      .getByRole('button', { name: 'Files', exact: true })
      .click();
    await navigation
      .getByRole('button', { name: 'History', exact: true })
      .click();
    await expect.element(oldest).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => reviewLayout.historyScrollTop(history))
      .toBe(position);
    await workspace
      .getByRole('button', { name: 'Open graph', exact: true })
      .click();
    await page.viewport(1280, 600);
    const graph = workspace.getByRole('region', {
      name: 'Graph reading area',
      exact: true,
    });
    await expect.element(graph).toBeVisible();
    reviewLayout.scrollToEnd(graph);
    await expect.poll(() => reviewLayout.scrollTop(graph)).toBeGreaterThan(0);
    const graphPosition = reviewLayout.scrollTop(graph);
    const graphOldest = graph.getByRole('button', { name: /^Initial commit / });
    await graphOldest.click();
    await workspace.getByRole('tab', { name: 'Graph', exact: true }).click();
    await expect.element(graphOldest).toHaveAttribute('aria-pressed', 'true');
    await expect.element(graph.getByRole('listitem')).toHaveLength(25);
    await expect.poll(() => reviewLayout.scrollTop(graph)).toBe(graphPosition);
    await navigation
      .getByRole('button', { name: 'Files', exact: true })
      .click();
    await navigation
      .getByRole('button', { name: 'History', exact: true })
      .click();
    await expect.element(oldest).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => reviewLayout.historyScrollTop(history))
      .toBe(position);
  } finally {
    await page.viewport(414, 896);
  }
});

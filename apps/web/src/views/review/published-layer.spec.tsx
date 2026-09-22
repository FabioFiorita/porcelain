import { beforeEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { publishedReviewFixture } from '../../api/review/published-fixture';
import type { ReviewLayer } from '../../domain/review';
import { PreferencesProvider } from '../workspace/preferences';
import { PublishedLayer } from './published-layer';

vi.mock('../../query/published-review', async (original) => ({
  ...(await original<typeof import('../../query/published-review')>()),
  useLayerMarks: () => ({
    marks: { data: { marks: [] } },
    toggle: { mutate: vi.fn() },
  }),
  useStepLines: () => ({
    data: {
      from: 1,
      lines: Array.from(
        { length: 60 },
        (_, index) => `const line${index + 1} = ${index};`,
      ),
    },
  }),
}));
vi.mock('../../query/comments', async (original) => ({
  ...(await original<typeof import('../../query/comments')>()),
  useComments: () => ({ threads: [] }),
}));
vi.mock('../../query/review', async (original) => ({
  ...(await original<typeof import('../../query/review')>()),
  useReviewChanges: () => [],
  useChangeDiffs: () => ({ diffs: new Map() }),
  useMarkReviewed: () => ({}),
  useUnmarkReviewed: () => ({}),
}));

const source = publishedReviewFixture('worktree', 'environment').layers[0];
const sourceStep = source?.steps[0];
if (!source || !sourceStep) throw new Error('Missing layer fixture');
const layer: ReviewLayer = {
  ...source,
  steps: ['First step', 'Second step'].map((title, index) => ({
    ...sourceStep,
    id: `step-${index}`,
    title,
    kind: 'context',
    pointer: { ...sourceStep.pointer, startLine: 1, endLine: 60 },
    location: { state: 'current', startLine: 1, endLine: 60 },
  })),
};
beforeEach(async () => {
  await page.viewport(1280, 800);
});

const view = () => (
  <PreferencesProvider>
    <div style={{ display: 'flex', width: 1100, height: 650 }}>
      <PublishedLayer
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        layer={layer}
        onOpen={vi.fn()}
      />
    </div>
  </PreferencesProvider>
);

it('shows the full snippet with only the surrounding step list scrolling', async () => {
  const screen = await render(view());
  const step = screen.getByRole('article', { name: 'Step First step' });
  await vi.waitFor(() => {
    const article = step.element();
    const code = article.querySelector('diffs-container');
    expect(code?.shadowRoot?.textContent).toContain('line60');
    expect(article.getBoundingClientRect().height).toBeGreaterThan(1000);
    let parent = code?.parentElement;
    while (parent && parent !== article) {
      expect(parent.scrollHeight - parent.clientHeight).toBeLessThanOrEqual(1);
      parent = parent.parentElement;
    }
  });
});

it('keeps the graph beside the selected code and lets another card replace it', async () => {
  const screen = await render(view());
  await screen.getByRole('tab', { name: 'Graph', exact: true }).click();
  await screen.getByRole('button', { name: 'First step', exact: true }).click();
  await expect
    .element(screen.getByRole('tab', { name: 'Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  const panel = screen.getByRole('region', { name: 'Selected step code' });
  await expect
    .element(panel.getByRole('heading', { name: 'First step' }))
    .toBeVisible();
  const graph = screen.container.querySelector('.react-flow');
  if (!graph) throw new Error('Missing graph');
  const graphRect = graph.getBoundingClientRect();
  const codeRect = panel.element().getBoundingClientRect();
  expect(Math.abs(graphRect.width - codeRect.width)).toBeLessThan(2);
  expect(graphRect.right).toBeLessThanOrEqual(codeRect.left + 1);
  await screen
    .getByRole('button', { name: 'Second step', exact: true })
    .click();
  await expect
    .element(panel.getByRole('heading', { name: 'Second step' }))
    .toBeVisible();
  await expect
    .element(panel.getByRole('heading', { name: 'First step' }))
    .not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Close code' }).click();
  await expect.element(panel).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole('button', { name: 'First step', exact: true }))
    .toBeVisible();
});

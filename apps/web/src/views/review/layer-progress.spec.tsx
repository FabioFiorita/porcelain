import type { ReviewedLayerMark } from '@porcelain/contracts/reviewed-files';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { publishedReviewFixture } from '../../api/review/published-fixture';
import { PublishedLayer } from './published-layer';

const state = vi.hoisted(() => ({
  marks: [] as ReviewedLayerMark[],
  mutate: vi.fn(),
  failed: false,
}));
vi.mock('../../query/published-review', () => ({
  usePublishedReview: () => ({ data: null }),
  useLayerMarks: () => ({
    marks: {
      data: { marks: state.marks },
      isPending: false,
      isError: state.failed,
    },
    toggle: { mutate: state.mutate, isPending: false, isError: false },
  }),
  useStepLines: () => ({ data: undefined, isPending: false }),
}));
vi.mock('../../query/review', async (original) => ({
  ...(await original<typeof import('../../query/review')>()),
  useReviewChanges: () => [],
  useChangeDiffs: () => ({ diffs: new Map() }),
  selectionKey: () => '',
}));
const source = publishedReviewFixture('worktree', 'environment').layers[0];
if (!source) throw new Error('Missing layer fixture');
const layer = { ...source, steps: [] };
const view = () => (
  <PublishedLayer
    scope={{ projectId: 'project', worktreeId: 'worktree' }}
    layer={layer}
    onOpen={vi.fn()}
  />
);
afterEach(() => {
  state.marks = [];
  state.failed = false;
  state.mutate.mockReset();
});

it('marks the exact displayed layer fingerprint', async () => {
  const screen = await render(view());
  await screen
    .getByRole('button', { name: 'Mark layer reviewed', exact: true })
    .click();
  expect(state.mutate).toHaveBeenCalledWith({
    layerId: layer.id,
    fingerprint: layer.fingerprint,
    reviewed: false,
  });
});
it('does not show a stale mark as reviewed even when its saved fingerprint matches', async () => {
  state.marks = [
    {
      layerId: layer.id,
      fingerprint: layer.fingerprint,
      reviewedAt: new Date().toISOString(),
      stale: false,
    },
  ];
  const screen = await render(view());
  await expect
    .element(screen.getByRole('button', { name: 'Reviewed', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  state.marks = state.marks.map((mark) => ({ ...mark, stale: true }));
  await screen.rerender(view());
  const button = screen.getByRole('button', {
    name: 'Mark changed layer reviewed',
  });
  await expect.element(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  expect(state.mutate).toHaveBeenCalledWith({
    layerId: layer.id,
    fingerprint: layer.fingerprint,
    reviewed: false,
  });
});
it('disables marking if its current status could not be read', async () => {
  state.failed = true;
  const screen = await render(view());
  await expect
    .element(
      screen.getByRole('button', { name: 'Mark layer reviewed', exact: true }),
    )
    .toBeDisabled();
  await expect.element(screen.getByRole('alert')).toBeVisible();
});

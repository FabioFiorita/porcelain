import '../../app.css';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { publishedReviewFixture } from '../../api/review/published-fixture';
import { PreferencesProvider } from '../workspace/preferences';
import { PublishedOverview } from './published-overview';

vi.mock('../workspace/theme', () => ({ useTheme: () => ({ dark: false }) }));

it('opens layers and uncovered changes without rendering all file diffs', async () => {
  const review = publishedReviewFixture(
    'a'.repeat(32),
    '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  );
  const onOpen = vi.fn();
  const screen = await render(
    <PublishedOverview review={review} onOpen={onOpen} />,
  );
  await screen
    .getByRole('button', { name: /A clearer review experience/ })
    .click();
  expect(onOpen).toHaveBeenLastCalledWith({
    kind: 'layer',
    layerId: review.layers[0]?.id,
  });
  await screen.getByRole('button', { name: /Not explained/ }).click();
  expect(onOpen).toHaveBeenLastCalledWith({ kind: 'unexplained' });
  await expect
    .element(screen.getByTestId('review-document'))
    .not.toBeInTheDocument();
});

it('switches before and after diagrams and opens a linked layer', async () => {
  const review = publishedReviewFixture(
    'a'.repeat(32),
    '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  );
  const layer = review.layers[0];
  if (!layer) throw new Error('Missing layer');
  review.diagram = {
    before: {
      lanes: ['Web'],
      boxes: [
        {
          id: 'before',
          lane: 0,
          label: 'Before behavior',
          kind: 'component',
          problem: 'The old behavior is hard to follow.',
        },
      ],
      arrows: [],
    },
    after: {
      lanes: ['Web', 'Server'],
      boxes: [
        {
          id: 'entry',
          lane: 0,
          label: 'Open explanation',
          kind: 'actor',
          layerId: layer.id,
          detail: 'Read the behavior layer.',
          change: 'new',
        },
        { id: 'result', lane: 1, label: 'Saved review', kind: 'storage' },
      ],
      arrows: [{ from: 'entry', to: 'result', label: 'Publish' }],
    },
  };
  const onOpen = vi.fn();
  const screen = await render(
    <PreferencesProvider>
      <div style={{ height: 600, width: 900, display: 'flex' }}>
        <PublishedOverview review={review} onOpen={onOpen} />
      </div>
    </PreferencesProvider>,
  );
  await screen.getByRole('tab', { name: 'Graph', exact: true }).click();
  await expect
    .element(
      screen.getByRole('button', { name: 'Open explanation', exact: true }),
    )
    .toBeVisible();
  await screen.getByRole('tab', { name: 'Before', exact: true }).click();
  await expect
    .element(screen.getByText('Before behavior', { exact: true }))
    .toBeVisible();
  await screen.getByRole('tab', { name: 'After', exact: true }).click();
  await screen
    .getByRole('button', { name: 'Open explanation', exact: true })
    .click();
  expect(onOpen).toHaveBeenCalledExactlyOnceWith({
    kind: 'layer',
    layerId: layer.id,
  });
});

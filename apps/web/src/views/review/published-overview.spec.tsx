import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { publishedReviewFixture } from '../../api/review/published-fixture';
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
  await expect
    .element(screen.getByRole('heading', { name: 'Not explained' }))
    .toBeVisible();
  await screen
    .getByRole('button', { name: /A clearer review experience/ })
    .click();
  expect(onOpen).toHaveBeenLastCalledWith({
    kind: 'layer',
    layerId: review.layers[0]?.id,
  });
  await screen.getByRole('button', { name: /src\/styles\/theme.css/ }).click();
  expect(onOpen).toHaveBeenLastCalledWith({
    kind: 'change',
    path: 'src/styles/theme.css',
  });
  await expect
    .element(screen.getByTestId('review-document'))
    .not.toBeInTheDocument();
});

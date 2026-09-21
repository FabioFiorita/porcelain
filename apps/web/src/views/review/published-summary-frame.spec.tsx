import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { publishedReviewFixture } from '../../api/review/published-fixture';
import { PublishedOverview } from './published-overview';

vi.mock('../workspace/theme', () => ({ useTheme: () => ({ dark: true }) }));

it('loads the summary URL in an opaque sandbox and accepts navigation only from that frame', async () => {
  const review = publishedReviewFixture(
    'a'.repeat(32),
    '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  );
  const onOpen = vi.fn();
  await render(<PublishedOverview review={review} onOpen={onOpen} />);
  const frame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Review summary"]',
  );
  expect(frame).not.toBeNull();
  expect(frame?.getAttribute('src')).toBe(`${review.summary.url}#theme=dark`);
  expect(frame?.hasAttribute('srcdoc')).toBe(false);
  expect(frame?.sandbox.contains('allow-same-origin')).toBe(false);
  expect(frame?.sandbox.contains('allow-scripts')).toBe(true);
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      data: { source: 'porcelain-summary', openLayer: 1 },
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame?.contentWindow ?? null,
      data: { source: 'porcelain-summary', openLayer: 999 },
    }),
  );
  expect(onOpen).not.toHaveBeenCalled();
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame?.contentWindow ?? null,
      data: { source: 'porcelain-summary', openLayer: 1 },
    }),
  );
  expect(onOpen).toHaveBeenCalledExactlyOnceWith({
    kind: 'layer',
    layerId: review.layers[0]?.id,
  });
});

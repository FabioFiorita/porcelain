import { expect, test } from './fixtures.tsx';

test('a header resize immediately after a programmatic jump preserves its destination', async ({
  pierreCodeView,
}) => {
  const destination = await pierreCodeView.jumpThenResizeHeader();
  await expect
    .poll(() => ({ destination, position: pierreCodeView.scrollTop() }))
    .toEqual({ destination: 1500, position: 1540 });
});

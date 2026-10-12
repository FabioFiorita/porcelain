import { expect, test } from './fixtures.tsx';

test('Pierre reset fully disposes a recycled non-editor instance', async ({
  pierreCodeView,
}) => {
  try {
    const observed = await pierreCodeView.observeRecycled();
    await expect.poll(() => observed.discardedIsRendered()).toBe(false);
    await expect.poll(() => observed.discardedCleanups()).toContain('recycle');
    observed.clear();

    pierreCodeView.reset();

    await expect.poll(() => observed.discardedCleanups()).toContain('dispose');
    await expect.poll(() => observed.retainedCleanups()).toContain('dispose');
    await expect.poll(() => pierreCodeView.renderedIds()).toEqual([]);
  } finally {
    pierreCodeView.dispose();
  }
});

test('Pierre removal fully disposes a recycled instance and preserves the retained instance', async ({
  pierreCodeView,
}) => {
  try {
    const observed = await pierreCodeView.observeRecycled();
    await expect.poll(() => observed.discardedIsRendered()).toBe(false);
    await expect.poll(() => observed.discardedCleanups()).toContain('recycle');
    observed.clear();

    pierreCodeView.removeDiscarded();

    await expect.poll(() => observed.discardedCleanups()).toContain('dispose');
    await expect.poll(() => observed.retainedIsRendered()).toBe(true);
    await expect
      .poll(() => observed.retainedCleanups())
      .not.toContain('dispose');
  } finally {
    pierreCodeView.dispose();
  }
});

import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a browser that was never paired sees how to pair it', async ({
  unpairedPage,
}) => {
  await expect
    .element(
      unpairedPage.getByRole('heading', { name: 'This browser is not paired' }),
    )
    .toBeVisible();
});

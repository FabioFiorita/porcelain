import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the workspace shows a heading it never renders', async ({
  pairedPage,
}) => {
  await expect
    .poll(() =>
      pairedPage.getByRole('heading', {
        name: 'A heading Porcelain never shows',
      }),
    )
    .toBeVisible();
});

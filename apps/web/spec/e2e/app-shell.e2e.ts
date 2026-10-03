import { expect, test } from './fixtures.ts';

test('a browser that was never paired sees how to pair it', async ({
  unpairedPage,
}) => {
  await expect(
    unpairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
});

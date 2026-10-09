import { expect, test } from './fixtures.ts';

test('the development catalog opens working primitives, file context actions target the held row, and native back navigation returns to Settings', async ({
  app,
}) => {
  expect(await app.run('component-library.yaml')).toEqual({
    name: 'Inspect primitives through the development catalog',
    status: 'passed',
  });
});

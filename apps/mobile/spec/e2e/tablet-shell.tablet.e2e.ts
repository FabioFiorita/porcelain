import { expect, test } from './fixtures.ts';

test('an iPad keeps the SwiftUI three-column split with its sidebar, master list and detail through sidebar collapse and rotation', async ({
  app,
}) => {
  expect(await app.run('tablet-shell.yaml')).toEqual({
    name: 'Three-column tablet destinations',
    status: 'passed',
  });
});

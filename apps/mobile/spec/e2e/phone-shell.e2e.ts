import { expect, test } from './fixtures.ts';

test('an unpaired phone moves between Files, Review, History and Settings in native tabs and is ready on Files again after a cold launch', async ({
  app,
}) => {
  expect(await app.run('phone-shell.yaml')).toEqual({
    name: 'Unpaired phone destinations',
    status: 'passed',
  });
});

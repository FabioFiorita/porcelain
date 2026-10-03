import { expect, test } from './fixtures.ts';

test('deep links open Files, History, Settings and Review directly, each in its unpaired empty state, warm and after a cold launch', async ({
  app,
}) => {
  expect(
    await app.run('destinations.yaml', {
      REVIEW_LINK: app.link('/'),
      FILES_LINK: app.link('/files'),
      HISTORY_LINK: app.link('/history'),
      SETTINGS_LINK: app.link('/settings'),
    }),
  ).toEqual({
    name: 'Deep links open each destination in its unpaired state',
    status: 'passed',
  });
});

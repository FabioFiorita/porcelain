import { expect, test } from './fixtures.ts';

test('Settings opened by deep link after a cold launch shows an environment whose server revoked the device as needing pairing and one whose server stopped as offline', async ({
  app,
  device,
  environments,
}) => {
  const first = await environments.start('Revoked');
  const second = await environments.start('Stopped');
  expect(
    await app.run('pair-environments.yaml', {
      FIRST_PAIRING_LINK: first.link,
      FIRST_ENVIRONMENT_NAME: first.name,
      SECOND_PAIRING_LINK: second.link,
      SECOND_ENVIRONMENT_NAME: second.name,
    }),
  ).toEqual({
    name: 'Pair two environments that are online',
    status: 'passed',
  });
  expect(await second.devices()).toEqual([
    {
      label: 'Native mobile proof',
      platform: device.kind === 'ipad' ? 'iPadOS' : 'iOS',
    },
  ]);

  await first.revokeDevices();
  expect(await first.devices()).toEqual([]);
  expect(await second.stop()).toBeUndefined();

  expect(
    await app.run('environment-states.yaml', {
      FIRST_ENVIRONMENT_NAME: first.name,
      SECOND_ENVIRONMENT_NAME: second.name,
      SETTINGS_LINK: app.link('/settings'),
    }),
  ).toEqual({
    name: "A cold launch deep-linked into Settings shows each environment's state",
    status: 'passed',
  });
});

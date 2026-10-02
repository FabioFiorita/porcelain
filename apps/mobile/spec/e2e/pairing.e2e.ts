import { expect, test } from './fixtures.ts';

test('a pasted link pairs two environments, an invalid link is refused, both are restored after a cold launch and each is forgotten through its context menu', async ({
  app,
  device,
  environments,
}) => {
  const first = await environments.start('First');
  const second = await environments.start('Second');

  expect(
    await app.run('pairing.yaml', {
      FIRST_PAIRING_LINK: first.link,
      FIRST_ENVIRONMENT_NAME: first.name,
      SECOND_PAIRING_LINK: second.link,
      SECOND_ENVIRONMENT_NAME: second.name,
    }),
  ).toEqual({
    name: 'Pair and restore multiple environments',
    status: 'passed',
  });

  const platform = device.kind === 'ipad' ? 'iPadOS' : 'iOS';
  expect(await first.devices()).toEqual([
    { label: 'Native mobile proof', platform },
  ]);
  expect(await second.devices()).toEqual([
    { label: 'Native mobile proof', platform },
  ]);
  expect(await first.nativeHits('POST', '/api/pair')).toHaveLength(1);
  expect(await second.nativeHits('POST', '/api/pair')).toHaveLength(1);
  expect(
    (await first.nativeHits('GET', '/api/environment')).length,
  ).toBeGreaterThanOrEqual(3);
  expect(
    (await second.nativeHits('GET', '/api/environment')).length,
  ).toBeGreaterThanOrEqual(3);
});

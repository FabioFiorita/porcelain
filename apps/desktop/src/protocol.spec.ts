import { Result, Schema } from 'effect';
import { expect, it } from 'vitest';
import { hostMessage, serverMessage } from './protocol.ts';

const startup = {
  kind: 'start',
  profile: '/tmp/porcelain-dev',
  outputEnd: 'd9a12edf-c836-46a1-9fd6-552c6eae7352',
  projectHome: '/tmp/projects',
  packageRoot: '/tmp/package',
  version: '0.65.0',
  session: { deviceId: 'device-1', secretHash: 'private-hash' },
};

it('accepts private startup configuration and strips unrelated host fields', () => {
  expect(
    Schema.decodeUnknownSync(hostMessage)({ ...startup, unrelated: 'ignored' }),
  ).toEqual(startup);
});

it.each([
  { ...startup, outputEnd: 'not-a-uuid' },
  { ...startup, session: { deviceId: 'device-1' } },
  { ...startup, profile: null },
  { kind: 'restart' },
])(
  'refuses malformed host configuration before starting its server: %j',
  (value) => {
    expect(
      Result.isFailure(Schema.decodeUnknownResult(hostMessage)(value)),
    ).toBe(true);
  },
);

it('accepts the two lifecycle commands', () => {
  expect(Schema.decodeUnknownSync(hostMessage)({ kind: 'stop' })).toEqual({
    kind: 'stop',
  });
  expect(Schema.decodeUnknownSync(hostMessage)({ kind: 'exit' })).toEqual({
    kind: 'exit',
  });
});

it('reads a ready address or a reported startup failure', () => {
  expect(
    Schema.decodeUnknownSync(serverMessage)({
      kind: 'ready',
      address: 'http://127.0.0.1:4738',
    }),
  ).toEqual({ kind: 'ready', address: 'http://127.0.0.1:4738' });
  expect(
    Schema.decodeUnknownSync(serverMessage)({
      kind: 'failed',
      message: 'Already owned',
    }),
  ).toEqual({ kind: 'failed', message: 'Already owned' });
  expect(
    Result.isFailure(
      Schema.decodeUnknownResult(serverMessage)({
        kind: 'ready',
        address: '/relative',
      }),
    ),
  ).toBe(true);
});

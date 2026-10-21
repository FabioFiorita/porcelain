import { expect, it } from 'vitest';
import { hostFromJson } from './device-host.ts';

const hostFile = '/repo/.mobile-device-host.json';

it('reads the agent-device executable each developer names for their own machine', () => {
  expect(
    hostFromJson({ agentDevice: '/opt/tools/agent-device' }, hostFile),
  ).toEqual({
    agentDevice: '/opt/tools/agent-device',
    androidSerial: undefined,
    remote: undefined,
    simulatorLimit: undefined,
  });
});

it('refuses a relative agent-device path and explains the field', () => {
  expect(() => hostFromJson({ agentDevice: 'agent-device' }, hostFile)).toThrow(
    /wrong: agentDevice must be an absolute path/,
  );
});

it('reads an explicit developer-local Android emulator selection without enabling a remote host', () => {
  expect(hostFromJson({ androidSerial: 'emulator-5580' }, hostFile)).toEqual({
    androidSerial: 'emulator-5580',
    agentDevice: undefined,
    remote: undefined,
    simulatorLimit: undefined,
  });
});

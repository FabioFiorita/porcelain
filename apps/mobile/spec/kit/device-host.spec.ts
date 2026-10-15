import { expect, it } from 'vitest';
import { hostFromJson } from './device-host.ts';

const hostFile = '/repo/.mobile-device-host.json';

it('reads the agent-device executable each developer names for their own machine', () => {
  expect(
    hostFromJson({ agentDevice: '/opt/tools/agent-device' }, hostFile),
  ).toEqual({
    agentDevice: '/opt/tools/agent-device',
    remote: undefined,
    simulatorLimit: undefined,
  });
});

it('leaves agent-device unset when the machine names none', () => {
  expect(hostFromJson({}, hostFile).agentDevice).toBeUndefined();
});

it('refuses a relative agent-device path and explains the field', () => {
  expect(() => hostFromJson({ agentDevice: 'agent-device' }, hostFile)).toThrow(
    /"agentDevice": the absolute path of the agent-device executable/,
  );
});

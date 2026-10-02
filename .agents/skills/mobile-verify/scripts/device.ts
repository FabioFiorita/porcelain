import { spawnSync } from 'node:child_process';
import { Refusal } from './instance.ts';

const keyboardSettleMs = 1500;

export type Target = { udid: string; session: string; cwd: string };

export function agentDevice(
  target: Target,
  args: readonly string[],
  { allowFailure = false } = {},
): string {
  const result = spawnSync(
    'agent-device',
    [
      ...args,
      '--platform',
      'ios',
      '--udid',
      target.udid,
      '--session',
      target.session,
    ],
    {
      cwd: target.cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 && !allowFailure)
    throw new Refusal(output.trim() || `agent-device ${args[0] ?? ''} failed`);
  return output;
}

export function fillField(
  target: Target,
  address: string,
  value: string,
): string {
  const filled = agentDevice(target, ['fill', address, value, '--settle']);
  agentDevice(target, ['wait', String(keyboardSettleMs)]);
  return filled;
}

export function selector(values: {
  id?: string | undefined;
  label?: string | undefined;
}): string {
  if (values.id !== undefined) return `id=${JSON.stringify(values.id)}`;
  if (values.label !== undefined)
    return `label=${JSON.stringify(values.label)}`;
  throw new Refusal(
    'Address the element with --id <testID> or --label <accessibility label>.',
  );
}

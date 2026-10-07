import { Effect } from 'effect';
import { runCommand } from '@porcelain/process';
import type { Limits } from '../../config/limits.ts';
import { macPrimaryService } from './mac-network-output.ts';

type NetworkDiscoveryLimits = Limits['access']['networkDiscovery'];

const output = Effect.fn('MacNetwork.output')(
  function* (
    command: string,
    args: readonly string[],
    limits: NetworkDiscoveryLimits,
    stdin?: string,
  ) {
    const result = yield* runCommand({
      command,
      args,
      stdin,
      timeoutMs: limits.commandTimeoutMs,
      maxBytes: limits.outputBytes,
      processGroup: limits.processGroup,
    });
    const completed =
      result.stopped === undefined || result.stopped === 'lingering';
    return completed && result.exitCode === 0
      ? result.stdout.toString('utf8')
      : '';
  },
  Effect.catch(() => Effect.succeed('')),
);

export const readMacRoute = Effect.fn('MacNetwork.readRoute')(
  (limits: NetworkDiscoveryLimits) =>
    output('/sbin/route', ['-n', 'get', 'default'], limits),
);

export const readMacPrimaryService = Effect.fn('MacNetwork.readPrimaryService')(
  function* (limits: NetworkDiscoveryLimits) {
    const service = macPrimaryService(
      yield* output(
        '/usr/sbin/scutil',
        [],
        limits,
        'show State:/Network/Global/IPv4\n',
      ),
    );
    return service === undefined
      ? ''
      : yield* output(
          '/usr/sbin/scutil',
          [],
          limits,
          `show State:/Network/Service/${service}/IPv4\n`,
        );
  },
);

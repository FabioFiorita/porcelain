import { NodeServices } from '@effect/platform-node';
import { Clock, Effect, Layer } from 'effect';
import { socketOwnerProbeLayer } from '../adapters/access/socket-owner-probe.ts';
import { CliRuntime, createCliRunner } from '../cli/runner.ts';
import { readCliSettings } from '../config/cli-settings.ts';
import { OwnerProbe } from '../ports/owner-probe.ts';

const run = createCliRunner(
  Layer.effect(
    CliRuntime,
    Effect.gen(function* () {
      return {
        startServer: () =>
          Effect.die(new Error('Desktop MCP cannot start a server')),
        ownerProbe: yield* OwnerProbe,
        clock: yield* Clock.Clock,
        limits: readCliSettings().limits,
        actionableErrors: [],
      };
    }),
  ).pipe(Layer.provide(socketOwnerProbeLayer)),
  NodeServices.layer,
);

export const runDesktopMcp = Effect.fn('DesktopMcp.run')(function* (
  args: readonly string[],
  version: string,
) {
  return yield* run(args, process.env, { desktopMcpVersion: version });
});

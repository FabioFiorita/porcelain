import { Context, Effect, Layer } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { Clock } from '@porcelain/kernel/ports';
import type { Limits } from '../config/limits.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import {
  openServiceUpdateRunner,
  readPackageVersion,
} from '../installer/index.ts';
import {
  issuePairings,
  listAccess,
  revokeAccess,
  setDeviceTrust,
} from './access-commands.ts';
import { runLocalServer, type StartServer } from './launcher.ts';
import { runMcpBridge } from './mcp-bridge.ts';
import { cliPackageRoot, runServiceCommand } from './service.ts';
import { shareRemoteAccess } from './share-command.ts';
import { reportStatus } from './status.ts';
import type {
  ServiceSettings,
  ShareAction,
  StatusSettings,
} from './settings.ts';

type PairSettings = StatusSettings & {
  readonly labels: readonly string[];
  readonly addresses: readonly string[];
  readonly trusted: boolean;
};

export class CliHost extends Context.Service<
  CliHost,
  {
    readonly startServer: StartServer;
    readonly ownerProbe: OwnerProbe;
    readonly clock: Clock;
    readonly limits: Limits;
    readonly wait: (ms: number) => Promise<void>;
    readonly homeDirectory: string;
    readonly searchPath: string;
    readonly stdout: (message: string) => void;
    readonly stderr: (message: string) => void;
    readonly prepareWebRoot:
      | ((signal: AbortSignal) => Promise<string>)
      | undefined;
  }
>()('@porcelain/server/CliHost') {}

export class CliOperations extends Context.Service<
  CliOperations,
  {
    readonly serve: (settings: ServerSettings) => Effect.Effect<void>;
    readonly status: (settings: StatusSettings) => Effect.Effect<number>;
    readonly pair: (settings: PairSettings) => Effect.Effect<void>;
    readonly devices: (settings: StatusSettings) => Effect.Effect<void>;
    readonly revoke: (
      settings: StatusSettings & { readonly id: string },
    ) => Effect.Effect<number>;
    readonly trust: (
      settings: StatusSettings & {
        readonly id: string;
        readonly trusted: boolean;
      },
    ) => Effect.Effect<void>;
    readonly share: (
      settings: StatusSettings & { readonly action: ShareAction },
    ) => Effect.Effect<number>;
    readonly mcp: (settings: StatusSettings) => Effect.Effect<void>;
    readonly service: (settings: ServiceSettings) => Effect.Effect<void>;
  }
>()('@porcelain/server/CliOperations') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const host = yield* CliHost;
      const {
        homeDirectory,
        searchPath,
        clock,
        ownerProbe,
        limits,
        stdout,
        stderr,
      } = host;
      const output = { stdout, stderr };
      return CliOperations.of({
        serve: Effect.fn('Cli.serve')(function* (settings) {
          const webRoot =
            host.prepareWebRoot === undefined
              ? settings.webRoot
              : yield* nativeOperation(host.prepareWebRoot);
          const packageRoot = cliPackageRoot();
          const version = yield* nativeOperation(() =>
            readPackageVersion(packageRoot),
          );
          const serviceUpdateRunner = yield* Effect.acquireRelease(
            Effect.sync(() =>
              openServiceUpdateRunner({
                homeDirectory,
                packageRoot,
                searchPath,
                command: limits.installer.command,
              }),
            ),
            (runner) => runner.close(),
          );
          yield* nativeOperation((signal) =>
            runLocalServer({ ...settings, webRoot }, signal, {
              startServer: host.startServer,
              host: { serviceUpdateRunner, version },
              output: (message) => stdout(`${message}\n`),
            }),
          );
        }, Effect.scoped),
        status: Effect.fn('Cli.status')((settings) =>
          nativeOperation(() =>
            reportStatus(
              settings,
              output,
              ownerProbe,
              limits.owner.probeTimeoutMs,
            ),
          ),
        ),
        pair: Effect.fn('Cli.pair')((settings) =>
          nativeOperation(() =>
            issuePairings(settings.dataDirectory, settings, output, limits),
          ),
        ),
        devices: Effect.fn('Cli.devices')((settings) =>
          nativeOperation(() =>
            listAccess(settings.dataDirectory, output, limits),
          ),
        ),
        revoke: Effect.fn('Cli.revoke')((settings) =>
          nativeOperation(() =>
            revokeAccess(settings.dataDirectory, settings.id, output, limits),
          ).pipe(Effect.map((revoked) => (revoked ? 0 : 1))),
        ),
        trust: Effect.fn('Cli.trust')((settings) =>
          nativeOperation(() =>
            setDeviceTrust(settings.dataDirectory, settings, output, limits),
          ),
        ),
        share: Effect.fn('Cli.share')((settings) =>
          nativeOperation(() =>
            shareRemoteAccess(
              settings.dataDirectory,
              settings.action,
              output,
              limits,
              host.wait,
            ),
          ),
        ),
        mcp: Effect.fn('Cli.mcp')((settings) =>
          nativeOperation(() =>
            runMcpBridge(settings.dataDirectory, limits.owner.mcpTimeoutMs),
          ),
        ),
        service: Effect.fn('Cli.service')((settings) =>
          nativeOperation(() =>
            runServiceCommand(settings, {
              homeDirectory,
              searchPath,
              clock,
              ownerProbe,
              limits,
              stdout,
            }),
          ),
        ),
      });
    }),
  );
}

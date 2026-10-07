import { NodeServices } from '@effect/platform-node';
import { Config, Layer, Schema, Clock, Effect } from 'effect';
import {
  InvalidDataDirectoryError,
  UnsupportedDatabaseVersionError,
} from '@porcelain/storage';
import { SocketOwnerProbe } from '../adapters/access/socket-owner-probe.ts';
import { CliRuntime, createCliRunner } from '../cli/runner.ts';
import { readCliSettings } from '../config/cli-settings.ts';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import { SocketPathTooLongError } from '../config/errors/socket-path-too-long-error.ts';
import { DataDirectoryInsecureError } from '../runtime/errors/data-directory-insecure-error.ts';
import { DataDirectoryOwnedError } from '../runtime/errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from '../runtime/errors/owner-socket-unreadable-error.ts';
import { OwnerSocketModeError } from '../runtime/errors/owner-socket-mode-error.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { ServerHost } from '../ports/server-host.ts';
import { startServer } from './compose-server.ts';

export const runCli = createCliRunner(
  Layer.effect(
    CliRuntime,
    Effect.gen(function* () {
      return {
        startServer: Effect.fn('CliHost.startServer')(function* (
          settings: ServerSettings,
          host: ServerHost,
        ) {
          return yield* startServer(settings, host);
        }),
        ownerProbe: new SocketOwnerProbe(),
        clock: yield* Clock.Clock,
        limits: readCliSettings().limits,
        actionableErrors: [
          ServeConfigurationError,
          DataDirectoryOwnedError,
          DataDirectoryInsecureError,
          OwnerSocketUnreadableError,
          OwnerSocketModeError,
          SocketPathTooLongError,
          InvalidDataDirectoryError,
          UnsupportedDatabaseVersionError,
          Config.ConfigError,
          Schema.SchemaError,
        ],
      };
    }),
  ),
  NodeServices.layer,
);

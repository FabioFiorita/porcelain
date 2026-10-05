import { NodeServices } from '@effect/platform-node';
import { Config, Layer, Schema } from 'effect';
import {
  InvalidDataDirectoryError,
  UnsupportedDatabaseVersionError,
} from '@porcelain/storage';
import { SocketOwnerProbe } from '../adapters/access/socket-owner-probe.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { CliRuntime, createCliRunner } from '../cli/runner.ts';
import { readCliSettings } from '../config/cli-settings.ts';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import { SocketPathTooLongError } from '../config/errors/socket-path-too-long-error.ts';
import { DataDirectoryInsecureError } from '../runtime/errors/data-directory-insecure-error.ts';
import { DataDirectoryOwnedError } from '../runtime/errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from '../runtime/errors/owner-socket-unreadable-error.ts';
import { OwnerSocketModeError } from '../runtime/errors/owner-socket-mode-error.ts';
import { delay } from '../runtime/delay.ts';
import { startServer } from './compose-server.ts';

export const runCli = createCliRunner(
  Layer.succeed(CliRuntime, {
    startServer,
    ownerProbe: new SocketOwnerProbe(),
    clock: new SystemClock(),
    limits: readCliSettings().limits,
    wait: delay,
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
  }),
  NodeServices.layer,
);

import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context, Effect, Option, Schema } from 'effect';
import { EnvironmentSettings } from '../config/environment-settings.ts';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import {
  absolutePathSchema,
  DEFAULT_DATA_DIRECTORY_NAME,
  readServerSettings,
} from '../config/server-settings.ts';

export type StatusSettings = { dataDirectory: string };

export type ServiceSettings = {
  action: 'install' | 'status' | 'update' | 'recover' | 'uninstall';
  allowDowngrade: boolean;
  dataDirectory: string;
  port: number;
};

export type ShareAction =
  | { kind: 'show' }
  | { kind: 'check' }
  | { kind: 'lan'; on: boolean }
  | { kind: 'tailnet'; hostname: string | undefined }
  | { kind: 'cloudflare'; hostname: string | undefined };

export class CliInvocation extends Context.Service<
  CliInvocation,
  {
    readonly homeDirectory: string;
    readonly webRoot: string;
  }
>()('@porcelain/server/CliInvocation') {}

export const defaultWebRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../web/dist',
);

export const dataDirectoryFor = Effect.fn('Cli.dataDirectory')(function* (
  directory: Option.Option<string>,
) {
  const environment = yield* (yield* EnvironmentSettings).read;
  const { homeDirectory } = yield* CliInvocation;
  const dataDirectory = Option.getOrElse(
    directory,
    () =>
      environment.dataDirectory ??
      join(homeDirectory, DEFAULT_DATA_DIRECTORY_NAME),
  );
  if (parse(dataDirectory).root === dataDirectory)
    return yield* Effect.die(
      new ServeConfigurationError(
        'The data directory cannot be the filesystem root',
      ),
    );
  return dataDirectory;
});

export const serverSettingsFor = Effect.fn('Cli.serverSettings')(
  function* (input: {
    readonly dataDirectory: Option.Option<string>;
    readonly host: Option.Option<string>;
    readonly port: Option.Option<number>;
    readonly allowHosts: readonly string[];
    readonly lan: boolean;
  }) {
    const environment = yield* (yield* EnvironmentSettings).read;
    const { homeDirectory, webRoot } = yield* CliInvocation;
    if (input.lan && Option.isSome(input.host))
      return yield* Effect.die(
        new ServeConfigurationError('--lan cannot be combined with --host'),
      );
    const host = input.lan
      ? '0.0.0.0'
      : Option.getOrElse(input.host, () => environment.host);
    const additionalHost = Option.filter(
      input.host,
      (value) => value !== '0.0.0.0' && value !== '::',
    );
    return readServerSettings({
      dataDirectory: yield* dataDirectoryFor(input.dataDirectory),
      projectHome: environment.projectHome ?? homeDirectory,
      host,
      port: Option.getOrElse(input.port, () => environment.port),
      webRoot: Schema.decodeUnknownSync(absolutePathSchema)(
        environment.webRoot ?? webRoot,
      ),
      allowedHosts: [
        ...new Set([
          ...Option.toArray(additionalHost),
          ...input.allowHosts,
          ...environment.allowedHosts,
        ]),
      ],
    });
  },
);

import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { Effect, Result, Schema } from 'effect';
import { ServeConfigurationError } from './errors/serve-configuration-error.ts';
import { LIMITS, type Limits } from './limits.ts';

const HOSTNAME_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

const DEFAULT_LISTEN_HOST = '127.0.0.1';
export const DEFAULT_LISTEN_PORT = LIMITS.network.defaultPort;
export const DEFAULT_DATA_DIRECTORY_NAME = '.porcelain';

function isValidListenHost(host: string) {
  if (
    host.length > LIMITS.network.maxHostnameLength ||
    host !== host.trim() ||
    host.includes('\0')
  )
    return false;
  if (isIP(host) !== 0) return true;
  const labels = host.split('.');
  if (
    labels.length === LIMITS.network.ipv4Octets &&
    labels.every((label) => /^\d+$/.test(label))
  )
    return false;
  return labels.every((label) => HOSTNAME_LABEL.test(label));
}

export const absolutePathSchema = Schema.String.check(
  Schema.makeFilter((path) => isAbsolute(path) && !path.includes('\0'), {
    message: 'Path must be absolute and contain no null bytes',
  }),
);

export const listenHostSchema = Schema.String.check(
  Schema.makeFilter(isValidListenHost, {
    message: 'Host must be a valid IP address or hostname',
  }),
);

export const listenPortSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: LIMITS.network.maxPort }),
);

const serverSettingsSchema = Schema.Struct({
  dataDirectory: absolutePathSchema,
  projectHome: absolutePathSchema,
  host: listenHostSchema.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_LISTEN_HOST)),
  ),
  port: listenPortSchema.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_LISTEN_PORT)),
  ),
  webRoot: Schema.optional(absolutePathSchema),
  allowedHosts: Schema.Array(listenHostSchema).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});

type ServerSettingsInput = typeof serverSettingsSchema.Encoded;

export type ServerSettings = typeof serverSettingsSchema.Type & {
  limits: Limits;
};

export function readServerSettings(input: ServerSettingsInput): ServerSettings {
  const parsed = Schema.decodeUnknownResult(serverSettingsSchema)(input);
  if (Result.isFailure(parsed))
    throw new ServeConfigurationError(
      `Invalid server settings: ${parsed.failure.message}`,
    );
  return { ...parsed.success, limits: LIMITS };
}

import { homedir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  absolutePathSchema,
  listenHostSchema,
} from '../config/server-settings.ts';

const defaultHost = '127.0.0.1';
const defaultPort = 3000;
const defaultTokenFileName = 'admin-token';

/** Environment variables consumed by the installed and repository launchers. */
export type ServeEnvironment = {
  PORCELAIN_DATA_DIRECTORY?: string;
  PORCELAIN_TOKEN_FILE?: string;
  PORCELAIN_HOST?: string;
  PORCELAIN_PORT?: string;
};

export type ServeSettings = {
  dataDirectory: string;
  tokenFile: string;
  host: string;
  port: number;
  webRoot: string;
};

type ServeArguments = {
  dataDirectory?: string;
  tokenFile?: string;
  host?: string;
  port?: number;
  lan: boolean;
  help: boolean;
};

export class ServeConfigurationError extends Error {
  override readonly name = 'ServeConfigurationError';
}

/** The source and packaged layouts both place the web build beside `server/`. */
const defaultWebRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../web/dist',
);

function optionValue(
  args: readonly string[],
  index: number,
  option: string,
): { value: string; nextIndex: number } {
  const argument = args[index];
  if (argument?.startsWith(`${option}=`)) {
    const value = argument.slice(option.length + 1);
    if (value.length > 0) return { value, nextIndex: index };
  }
  const value = args[index + 1];
  if (value !== undefined && !value.startsWith('--'))
    return { value, nextIndex: index + 1 };
  throw new ServeConfigurationError(`${option} requires a value`);
}

function parsePort(value: string, source: string): number {
  if (!/^\d+$/.test(value))
    throw new ServeConfigurationError(
      `${source} must be an integer from 0 to 65535`,
    );
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535)
    throw new ServeConfigurationError(
      `${source} must be an integer from 0 to 65535`,
    );
  return port;
}

function parseAbsolutePath(value: string, source: string): string {
  if (!isAbsolute(value))
    throw new ServeConfigurationError(`${source} must be an absolute path`);
  try {
    return absolutePathSchema.parse(value);
  } catch {
    throw new ServeConfigurationError(`${source} must be an absolute path`);
  }
}

function parseHost(value: string, source: string): string {
  try {
    return listenHostSchema.parse(value);
  } catch {
    throw new ServeConfigurationError(
      `${source} must be a valid IP address or hostname`,
    );
  }
}

function parseArguments(args: readonly string[]): ServeArguments {
  const parsed: ServeArguments = { lan: false, help: false };
  let index = 0;
  const command = args[0];
  if (command === 'serve') index = 1;
  else if (command === 'help' || command === '--help' || command === '-h') {
    parsed.help = true;
    return parsed;
  } else if (
    command !== undefined &&
    !command.startsWith('-') &&
    command !== '--'
  ) {
    throw new ServeConfigurationError(`Unknown command: ${command}`);
  }

  for (; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--lan') {
      parsed.lan = true;
      continue;
    }
    if (
      argument === '--data-directory' ||
      argument?.startsWith('--data-directory=')
    ) {
      const option = optionValue(args, index, '--data-directory');
      parsed.dataDirectory = parseAbsolutePath(
        option.value,
        '--data-directory',
      );
      index = option.nextIndex;
      continue;
    }
    if (argument === '--token-file' || argument?.startsWith('--token-file=')) {
      const option = optionValue(args, index, '--token-file');
      parsed.tokenFile = parseAbsolutePath(option.value, '--token-file');
      index = option.nextIndex;
      continue;
    }
    if (argument === '--host' || argument?.startsWith('--host=')) {
      const option = optionValue(args, index, '--host');
      parsed.host = parseHost(option.value, '--host');
      index = option.nextIndex;
      continue;
    }
    if (argument === '--port' || argument?.startsWith('--port=')) {
      const option = optionValue(args, index, '--port');
      parsed.port = parsePort(option.value, '--port');
      index = option.nextIndex;
      continue;
    }
    throw new ServeConfigurationError(`Unknown option: ${argument}`);
  }
  if (parsed.lan && parsed.host !== undefined)
    throw new ServeConfigurationError('--lan cannot be combined with --host');
  return parsed;
}

function dataDirectoryFor(
  parsed: ServeArguments,
  environment: ServeEnvironment,
  homeDirectory: string,
): string {
  if (parsed.dataDirectory) return parsed.dataDirectory;
  if (environment.PORCELAIN_DATA_DIRECTORY)
    return parseAbsolutePath(
      environment.PORCELAIN_DATA_DIRECTORY,
      'PORCELAIN_DATA_DIRECTORY',
    );
  return join(homeDirectory, '.porcelain');
}

function tokenFileFor(
  parsed: ServeArguments,
  environment: ServeEnvironment,
  dataDirectory: string,
): string {
  if (parsed.tokenFile) return parsed.tokenFile;
  if (environment.PORCELAIN_TOKEN_FILE)
    return parseAbsolutePath(
      environment.PORCELAIN_TOKEN_FILE,
      'PORCELAIN_TOKEN_FILE',
    );
  return join(dataDirectory, defaultTokenFileName);
}

/** Parse `serve` arguments without reading or writing any state. */
export function parseServeSettings(
  args: readonly string[] = [],
  environment: ServeEnvironment = process.env,
  homeDirectory: string = homedir(),
  webRoot: string = defaultWebRoot,
): ServeSettings | { help: true } {
  const parsed = parseArguments(args);
  if (parsed.help) return { help: true };

  const dataDirectory = dataDirectoryFor(parsed, environment, homeDirectory);
  const tokenFile = tokenFileFor(parsed, environment, dataDirectory);
  if (parsePath(dataDirectory).root === dataDirectory)
    throw new ServeConfigurationError(
      'The data directory cannot be the filesystem root',
    );
  if (resolve(tokenFile) === resolve(dataDirectory, 'server.lock'))
    throw new ServeConfigurationError(
      'The token file cannot be the server ownership file',
    );

  const host = parsed.lan
    ? '0.0.0.0'
    : (parsed.host ??
      (environment.PORCELAIN_HOST
        ? parseHost(environment.PORCELAIN_HOST, 'PORCELAIN_HOST')
        : defaultHost));
  const port =
    parsed.port ??
    (environment.PORCELAIN_PORT
      ? parsePort(environment.PORCELAIN_PORT, 'PORCELAIN_PORT')
      : defaultPort);

  return {
    dataDirectory,
    tokenFile,
    host,
    port,
    webRoot: parseAbsolutePath(webRoot, 'web root'),
  };
}

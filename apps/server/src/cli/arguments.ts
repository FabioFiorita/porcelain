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
const wildcardHosts = new Set(['0.0.0.0', '::']);

/** Environment variables consumed by the installed and repository launchers. */
export type ServeEnvironment = {
  PORCELAIN_DATA_DIRECTORY?: string;
  PORCELAIN_TOKEN_FILE?: string;
  PORCELAIN_HOST?: string;
  PORCELAIN_PORT?: string;
};

export type ServeSettings = {
  dataDirectory: string;
  projectHome: string;
  tokenFile: string;
  host: string;
  port: number;
  webRoot: string;
  allowedHosts: string[];
};

export type StatusSettings = {
  dataDirectory: string;
};

export type CliCommand =
  | { command: 'help' }
  | { command: 'serve'; settings: ServeSettings }
  | { command: 'status'; settings: StatusSettings };

type ServeArguments = {
  dataDirectory?: string;
  tokenFile?: string;
  host?: string;
  port?: number;
  allowHosts: string[];
  lan: boolean;
  help: boolean;
  command: 'serve' | 'status';
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
  const parsed: ServeArguments = {
    lan: false,
    help: false,
    allowHosts: [],
    command: 'serve',
  };
  let index = 0;
  const command = args[0];
  if (command === 'serve' || command === 'status') {
    parsed.command = command;
    index = 1;
  } else if (command === 'help' || command === '--help' || command === '-h') {
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
    if (argument === '--allow-host' || argument?.startsWith('--allow-host=')) {
      const option = optionValue(args, index, '--allow-host');
      parsed.allowHosts.push(parseHost(option.value, '--allow-host'));
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

/**
 * Parse arguments without reading or writing any state.  The home directory is
 * a required argument rather than a default read here: resolving it is the
 * composition root's job, so nothing below it can reach the real home by
 * forgetting a parameter.
 */
export function parseCliArguments(
  args: readonly string[],
  environment: ServeEnvironment,
  homeDirectory: string,
  webRoot: string = defaultWebRoot,
): CliCommand {
  const parsed = parseArguments(args);
  if (parsed.help) return { command: 'help' };

  const dataDirectory = dataDirectoryFor(parsed, environment, homeDirectory);
  if (parsePath(dataDirectory).root === dataDirectory)
    throw new ServeConfigurationError(
      'The data directory cannot be the filesystem root',
    );
  if (parsed.command === 'status')
    return { command: 'status', settings: { dataDirectory } };

  const tokenFile = tokenFileFor(parsed, environment, dataDirectory);
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
  // A name the server was told to listen on is a name it may answer to; a
  // wildcard is not a name, and the connection's own address is accepted
  // separately.
  const allowedHosts = [
    ...new Set(
      [...(parsed.host && !wildcardHosts.has(host) ? [host] : [])].concat(
        parsed.allowHosts,
      ),
    ),
  ];

  return {
    command: 'serve',
    settings: {
      dataDirectory,
      projectHome: homeDirectory,
      tokenFile,
      host,
      port,
      webRoot: parseAbsolutePath(webRoot, 'web root'),
      allowedHosts,
    },
  };
}

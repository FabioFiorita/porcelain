import {
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import {
  absolutePathSchema,
  listenHostSchema,
} from '../config/server-settings.ts';
import {
  defaultDataDirectoryName,
  defaultListenHost,
  defaultListenPort,
  readEnvironmentSettings,
  type EnvironmentSettings,
  type PorcelainEnvironment,
} from '../config/startup-settings.ts';

const wildcardHosts = new Set(['0.0.0.0', '::']);

export type ServeSettings = {
  dataDirectory: string;
  projectHome: string;
  host: string;
  port: number;
  webRoot: string;
  allowedHosts: string[];
};

export type StatusSettings = {
  dataDirectory: string;
};

type ServiceAction = 'install' | 'status' | 'update' | 'uninstall';

export type ServiceSettings = {
  action: ServiceAction;
  allowDowngrade: boolean;
  dataDirectory: string;
  host: string;
  port: number;
  allowedHosts: string[];
};

type PairSettings = {
  dataDirectory: string;
  labels: string[];
  addresses: string[];
};

type RevokeSettings = {
  dataDirectory: string;
  id: string;
};

export type CliCommand =
  | { command: 'help' }
  | { command: 'serve'; settings: ServeSettings }
  | { command: 'status'; settings: StatusSettings }
  | { command: 'pair'; settings: PairSettings }
  | { command: 'devices'; settings: StatusSettings }
  | { command: 'revoke'; settings: RevokeSettings }
  | { command: 'mcp'; settings: StatusSettings }
  | { command: 'service'; settings: ServiceSettings };

type ServeArguments = {
  dataDirectory?: string;
  host?: string;
  port?: number;
  allowHosts: string[];
  addresses: string[];
  operands: string[];
  lan: boolean;
  help: boolean;
  allowDowngrade: boolean;
  serviceAction?: ServiceAction;
  command: CliCommand['command'];
};

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

function parseOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ServeConfigurationError(
      '--address must be an origin such as http://192.168.1.5:3000',
    );
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  )
    throw new ServeConfigurationError(
      '--address must be an origin such as http://192.168.1.5:3000',
    );
  return url.origin;
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
    allowDowngrade: false,
    allowHosts: [],
    addresses: [],
    operands: [],
    command: 'serve',
  };
  let index = 0;
  const command = args[0];
  if (command === 'service') {
    parsed.command = command;
    const action = args[1];
    if (
      action !== 'install' &&
      action !== 'status' &&
      action !== 'update' &&
      action !== 'uninstall'
    )
      throw new ServeConfigurationError(
        'service needs one action: install, status, update, or uninstall',
      );
    parsed.serviceAction = action;
    index = 2;
  } else if (
    command === 'serve' ||
    command === 'status' ||
    command === 'pair' ||
    command === 'devices' ||
    command === 'revoke' ||
    command === 'mcp'
  ) {
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
    if (argument === '--allow-downgrade') {
      parsed.allowDowngrade = true;
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
      throw new ServeConfigurationError(
        '--token-file is gone: there is no shared access token. Pair a device with: porcelain pair <name> --address <origin>',
      );
    }
    if (argument === '--host' || argument?.startsWith('--host=')) {
      const option = optionValue(args, index, '--host');
      parsed.host = parseHost(option.value, '--host');
      index = option.nextIndex;
      continue;
    }
    if (argument === '--address' || argument?.startsWith('--address=')) {
      const option = optionValue(args, index, '--address');
      parsed.addresses.push(parseOrigin(option.value));
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
    if (argument !== undefined && !argument.startsWith('-')) {
      parsed.operands.push(argument);
      continue;
    }
    throw new ServeConfigurationError(`Unknown option: ${argument}`);
  }
  if (parsed.lan && parsed.host !== undefined)
    throw new ServeConfigurationError('--lan cannot be combined with --host');
  if (parsed.command === 'service') {
    if (parsed.operands.length > 0)
      throw new ServeConfigurationError('service does not accept operands');
    if (parsed.addresses.length > 0)
      throw new ServeConfigurationError('--address is not a service option');
    if (parsed.allowDowngrade && parsed.serviceAction !== 'update')
      throw new ServeConfigurationError(
        '--allow-downgrade is only valid with service update',
      );
    if (
      parsed.serviceAction !== 'install' &&
      (parsed.lan ||
        parsed.host !== undefined ||
        parsed.port !== undefined ||
        parsed.allowHosts.length > 0)
    )
      throw new ServeConfigurationError(
        'serve options are only valid with service install',
      );
  }
  return parsed;
}

function dataDirectoryFor(
  parsed: ServeArguments,
  environment: EnvironmentSettings,
  homeDirectory: string,
): string {
  return (
    parsed.dataDirectory ??
    environment.dataDirectory ??
    join(homeDirectory, defaultDataDirectoryName)
  );
}

export function parseCliArguments(
  args: readonly string[],
  variables: PorcelainEnvironment,
  homeDirectory: string,
  webRoot: string = defaultWebRoot,
): CliCommand {
  const parsed = parseArguments(args);
  if (parsed.help) return { command: 'help' };

  const environment = readEnvironmentSettings(variables);
  const dataDirectory = dataDirectoryFor(parsed, environment, homeDirectory);
  if (parsePath(dataDirectory).root === dataDirectory)
    throw new ServeConfigurationError(
      'The data directory cannot be the filesystem root',
    );
  if (parsed.command === 'status')
    return { command: 'status', settings: { dataDirectory } };
  if (parsed.command === 'devices')
    return { command: 'devices', settings: { dataDirectory } };
  if (parsed.command === 'mcp')
    return { command: 'mcp', settings: { dataDirectory } };
  if (parsed.command === 'pair') {
    if (parsed.operands.length === 0)
      throw new ServeConfigurationError(
        'pair needs at least one device name, for example: porcelain pair iPhone iPad',
      );
    if (parsed.addresses.length === 0)
      throw new ServeConfigurationError(
        'pair needs at least one --address, for example: --address http://192.168.1.5:3000',
      );
    return {
      command: 'pair',
      settings: {
        dataDirectory,
        labels: parsed.operands,
        addresses: parsed.addresses,
      },
    };
  }
  if (parsed.command === 'revoke') {
    const id = parsed.operands[0];
    if (parsed.operands.length !== 1 || !id)
      throw new ServeConfigurationError('revoke needs exactly one id');
    return { command: 'revoke', settings: { dataDirectory, id } };
  }

  const host = parsed.lan
    ? '0.0.0.0'
    : (parsed.host ?? environment.host ?? defaultListenHost);
  const port = parsed.port ?? environment.port ?? defaultListenPort;
  const allowedHosts = [
    ...new Set([
      ...(parsed.host && !wildcardHosts.has(host) ? [host] : []),
      ...parsed.allowHosts,
      ...environment.allowedHosts,
    ]),
  ];

  if (parsed.command === 'service')
    return {
      command: 'service',
      settings: {
        action: parsed.serviceAction ?? 'status',
        allowDowngrade: parsed.allowDowngrade,
        dataDirectory,
        host,
        port,
        allowedHosts,
      },
    };

  return {
    command: 'serve',
    settings: {
      dataDirectory,
      projectHome: environment.projectHome ?? homeDirectory,
      host,
      port,
      webRoot: parseAbsolutePath(environment.webRoot ?? webRoot, 'web root'),
      allowedHosts,
    },
  };
}

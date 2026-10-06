import { NodeServices } from '@effect/platform-node';
import { ConfigProvider, Console, Effect, Layer } from 'effect';
import { expect, it } from '@effect/vitest';
import {
  EnvironmentSettings,
  type PorcelainEnvironment,
} from '../config/environment-settings.ts';
import { cliProgram } from './cli-program.ts';
import { CliOperations } from './operations.ts';
import { CliInvocation } from './settings.ts';

function agentCli(
  args: readonly string[],
  environment: PorcelainEnvironment = {},
) {
  const calls: { operation: string; input: unknown }[] = [];
  const output: string[] = [];
  const record = (operation: string, input: unknown) =>
    Effect.sync(() => {
      calls.push({ operation, input });
    });
  const operations = Layer.succeed(CliOperations, {
    serve: (input) => record('serve', input),
    status: (input) => record('status', input).pipe(Effect.as(0)),
    pair: (input) => record('pair', input),
    devices: (input) => record('devices', input),
    revoke: (input) => record('revoke', input).pipe(Effect.as(1)),
    trust: (input) => record('trust', input),
    share: (input) => record('share', input).pipe(Effect.as(0)),
    mcp: (input) => record('mcp', input),
    service: (input) => record('service', input),
  });
  const console: Console.Console = {
    ...globalThis.console,
    log: (...values: readonly unknown[]) => output.push(values.join(' ')),
    error: (...values: readonly unknown[]) => output.push(values.join(' ')),
  };
  return cliProgram(args, '1.2.3').pipe(
    Effect.provide(
      Layer.mergeAll(
        operations,
        EnvironmentSettings.layer,
        Layer.succeed(CliInvocation, {
          homeDirectory: '/home/agent',
          webRoot: '/build/web',
        }),
        ConfigProvider.layer(ConfigProvider.fromEnvRecord({ ...environment })),
        NodeServices.layer,
      ),
    ),
    Effect.provideService(Console.Console, console),
    Effect.map((code) => ({ code, calls, output })),
  );
}

it.effect(
  'serves by default with CLI settings overriding environment settings',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli(
        [
          '--host',
          'localhost',
          '--port=0',
          '--allow-host',
          'agent.example',
          '--allow-host',
          'tablet.example',
        ],
        {
          PORCELAIN_HOST: '127.0.0.1',
          PORCELAIN_PORT: '8123',
          PORCELAIN_PROJECT_HOME: '/projects',
          PORCELAIN_ALLOWED_HOSTS: 'remote.example',
        },
      );
      expect(result.code).toBe(0);
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        operation: 'serve',
        input: {
          host: 'localhost',
          port: 0,
          projectHome: '/projects',
          dataDirectory: '/home/agent/.porcelain',
          webRoot: '/build/web',
          allowedHosts: [
            'localhost',
            'agent.example',
            'tablet.example',
            'remote.example',
          ],
        },
      });
    }),
);

it.effect(
  'dispatches an explicit LAN serve with an isolated data directory',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        'serve',
        '--lan',
        '--data-directory=/tmp/agent-server',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        operation: 'serve',
        input: { host: '0.0.0.0', dataDirectory: '/tmp/agent-server' },
      });
    }),
);

it.effect(
  'pairs every named device with the normalized origins and trust requested by the agent',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        'pair',
        'iPhone',
        'iPad',
        '--address',
        'http://localhost:3000/',
        '--address',
        'https://remote.example',
        '--trusted',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        {
          operation: 'pair',
          input: {
            dataDirectory: '/home/agent/.porcelain',
            labels: ['iPhone', 'iPad'],
            addresses: ['http://localhost:3000', 'https://remote.example'],
            trusted: true,
          },
        },
      ]);
    }),
);

it.effect('fails pairing before dispatch when an address has credentials', () =>
  Effect.gen(function* () {
    const result = yield* agentCli([
      'pair',
      'iPad',
      '--address',
      'https://owner:secret@remote.example',
    ]);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect('requires an explicit address before pairing', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['pair', 'iPad']);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect('requires at least one named device before pairing', () =>
  Effect.gen(function* () {
    const result = yield* agentCli([
      'pair',
      '--address',
      'http://localhost:3000',
    ]);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect('keeps a failed revoke observable through the exit code', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['revoke', 'missing-id']);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([
      {
        operation: 'revoke',
        input: { dataDirectory: '/home/agent/.porcelain', id: 'missing-id' },
      },
    ]);
  }),
);

it.effect('removes trust through the same operation with trusted false', () =>
  Effect.gen(function* () {
    const result = yield* agentCli([
      'untrust',
      'phone-id',
      '--data-directory',
      '/tmp/agent-data',
    ]);
    expect(result.code).toBe(0);
    expect(result.calls).toEqual([
      {
        operation: 'trust',
        input: {
          dataDirectory: '/tmp/agent-data',
          id: 'phone-id',
          trusted: false,
        },
      },
    ]);
  }),
);

it.effect(
  'turns off Cloudflare sharing through the declared route command',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        'share',
        'cloudflare',
        'off',
        '--data-directory',
        '/tmp/agent-data',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        {
          operation: 'share',
          input: {
            dataDirectory: '/tmp/agent-data',
            action: { kind: 'cloudflare', hostname: undefined },
          },
        },
      ]);
    }),
);

it.effect('keeps service downgrade permission specific to update', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['service', 'install', '--allow-downgrade']);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect(
  'dispatches an explicitly permitted service downgrade to update',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        'service',
        'update',
        '--allow-downgrade',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        {
          operation: 'service',
          input: {
            dataDirectory: '/home/agent/.porcelain',
            action: 'update',
            port: 3000,
            allowDowngrade: true,
          },
        },
      ]);
    }),
);

it.effect('refuses to install a remotely listening owner service', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['service', 'install', '--lan']);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect(
  'rejects a pairing-only flag on status before reaching the owner socket',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli(['status', '--trusted']);
      expect(result.code).toBe(1);
      expect(result.calls).toEqual([]);
    }),
);

it.effect('reads status from the configured data directory', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['status'], {
      PORCELAIN_DATA_DIRECTORY: '/tmp/agent-data',
    });
    expect(result.code).toBe(0);
    expect(result.calls).toEqual([
      { operation: 'status', input: { dataDirectory: '/tmp/agent-data' } },
    ]);
  }),
);

it.effect('rejects an invalid listen port before starting a server', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['serve', '--port', '65536']);
    expect(result.code).toBe(1);
    expect(result.calls).toEqual([]);
  }),
);

it.effect(
  'shows native help without reading invalid application configuration or dispatching work',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli(['--help'], {
        PORCELAIN_PORT: 'broken',
        PORCELAIN_HOST: 'bad host',
      });
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([]);
      expect(result.output.join('\n')).toContain('porcelain');
      expect(result.output.join('\n')).toContain('SUBCOMMANDS');
    }),
);

it.effect('retains the help command as native generated help', () =>
  Effect.gen(function* () {
    const result = yield* agentCli(['help']);
    expect(result.code).toBe(0);
    expect(result.calls).toEqual([]);
    expect(result.output.join('\n')).toContain('SUBCOMMANDS');
  }),
);

it.effect(
  'makes shell completion metadata available without dispatching application work',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli(['--completions', 'zsh']);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([]);
      expect(result.output.join('\n')).toContain('porcelain');
      expect(result.output.join('\n')).toContain('--data-directory');
    }),
);

it.effect(
  'applies the shared data directory when it precedes the route subcommand',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        'share',
        '--data-directory',
        '/tmp/agent-data',
        'lan',
        'on',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        {
          operation: 'share',
          input: {
            dataDirectory: '/tmp/agent-data',
            action: { kind: 'lan', on: true },
          },
        },
      ]);
    }),
);

it.effect(
  'inherits the shared data directory when it precedes the application command',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli([
        '--data-directory',
        '/tmp/agent-data',
        'status',
      ]);
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        { operation: 'status', input: { dataDirectory: '/tmp/agent-data' } },
      ]);
    }),
);

it.effect(
  'keeps the configured listen port when installing the local owner service',
  () =>
    Effect.gen(function* () {
      const result = yield* agentCli(['service', 'install'], {
        PORCELAIN_PORT: '8123',
      });
      expect(result.code).toBe(0);
      expect(result.calls).toEqual([
        {
          operation: 'service',
          input: {
            dataDirectory: '/home/agent/.porcelain',
            action: 'install',
            port: 8123,
            allowDowngrade: false,
          },
        },
      ]);
    }),
);

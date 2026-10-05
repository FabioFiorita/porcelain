import { Context, Effect, Option, Ref, Schema } from 'effect';
import { Argument, Command, Flag, GlobalFlag } from 'effect/cli';
import {
  absolutePathSchema,
  listenHostSchema,
  listenPortSchema,
  DEFAULT_LISTEN_PORT,
} from '../config/server-settings.ts';
import { EnvironmentSettings } from '../config/environment-settings.ts';
import { CliOperations } from './operations.ts';
import {
  dataDirectoryFor,
  serverSettingsFor,
  type ShareAction,
} from './settings.ts';

export class CliExit extends Context.Service<CliExit, Ref.Ref<number>>()(
  '@porcelain/server/CliExit',
) {}

const dataDirectory = Flag.String('data-directory').pipe(
  Flag.withSchema(absolutePathSchema),
  Flag.withDescription(
    'Persistent state directory (defaults to PORCELAIN_DATA_DIRECTORY or ~/.porcelain)',
  ),
  Flag.optional,
);
const port = Flag.Int('port').pipe(
  Flag.withSchema(listenPortSchema),
  Flag.optional,
);
const serveFlags = {
  host: Flag.String('host').pipe(
    Flag.withSchema(listenHostSchema),
    Flag.optional,
  ),
  port,
  allowHosts: Flag.String('allow-host').pipe(
    Flag.withSchema(listenHostSchema),
    Flag.atLeast(0),
  ),
  lan: Flag.Boolean('lan').pipe(Flag.withDefault(false)),
};
const originSchema = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.pathname === '/' &&
          url.search === '' &&
          url.hash === '' &&
          url.username === '' &&
          url.password === ''
        );
      } catch {
        return false;
      }
    },
    {
      message:
        'Address must be an HTTP(S) origin such as http://192.168.1.5:3000',
    },
  ),
);

const rootConfiguration = Command.make('porcelain', serveFlags).pipe(
  Command.withSharedFlags({ dataDirectory }),
);
const directory = Effect.map(rootConfiguration, (input) => input.dataDirectory);

const finish = Effect.fn('Cli.exitCode')(function* (code: number) {
  const exit = yield* CliExit;
  yield* Ref.set(exit, code);
});

const serveHandler = Effect.fn('Cli.serveCommand')(function* (input: {
  readonly dataDirectory: Option.Option<string>;
  readonly host: Option.Option<string>;
  readonly port: Option.Option<number>;
  readonly allowHosts: readonly string[];
  readonly lan: boolean;
}) {
  const operations = yield* CliOperations;
  yield* operations.serve(yield* serverSettingsFor(input));
});

const serve = Command.make(
  'serve',
  serveFlags,
  Effect.fn('Cli.explicitServe')(function* (input) {
    const parent = yield* rootConfiguration;
    yield* serveHandler({ ...input, dataDirectory: parent.dataDirectory });
  }),
).pipe(Command.withDescription('Serve the web app and the Porcelain server'));
const status = Command.make(
  'status',
  {},
  Effect.fn('Cli.statusCommand')(function* () {
    const operations = yield* CliOperations;
    yield* finish(
      yield* operations.status({
        dataDirectory: yield* dataDirectoryFor(yield* directory),
      }),
    );
  }),
).pipe(
  Command.withDescription('Report whether a server owns the data directory'),
);
const devices = Command.make(
  'devices',
  {},
  Effect.fn('Cli.devicesCommand')(function* () {
    const operations = yield* CliOperations;
    yield* operations.devices({
      dataDirectory: yield* dataDirectoryFor(yield* directory),
    });
  }),
).pipe(
  Command.withDescription('List pending pairing links and paired devices'),
);
const pair = Command.make(
  'pair',
  {
    labels: Argument.String('name').pipe(Argument.atLeast(1)),
    addresses: Flag.String('address').pipe(
      Flag.withSchema(originSchema),
      Flag.atLeast(1),
    ),
    trusted: Flag.Boolean('trusted').pipe(Flag.withDefault(false)),
  },
  Effect.fn('Cli.pairCommand')(function* (input) {
    const operations = yield* CliOperations;
    yield* operations.pair({
      dataDirectory: yield* dataDirectoryFor(yield* directory),
      labels: input.labels,
      addresses: input.addresses.map((address) => new URL(address).origin),
      trusted: input.trusted,
    });
  }),
).pipe(
  Command.withDescription('Print one single-use pairing link per device name'),
);
const revoke = Command.make(
  'revoke',
  {
    id: Argument.String('id').pipe(Argument.withSchema(Schema.NonEmptyString)),
  },
  Effect.fn('Cli.revokeCommand')(function* (input) {
    const operations = yield* CliOperations;
    yield* finish(
      yield* operations.revoke({
        dataDirectory: yield* dataDirectoryFor(yield* directory),
        id: input.id,
      }),
    );
  }),
).pipe(Command.withDescription('Revoke a pending link or a paired device'));
const trustCommand = (name: 'trust' | 'untrust', trusted: boolean) =>
  Command.make(
    name,
    {
      id: Argument.String('id').pipe(
        Argument.withSchema(Schema.NonEmptyString),
      ),
    },
    Effect.fn(`Cli.${name}Command`)(function* (input) {
      const operations = yield* CliOperations;
      yield* operations.trust({
        dataDirectory: yield* dataDirectoryFor(yield* directory),
        id: input.id,
        trusted,
      });
    }),
  ).pipe(
    Command.withDescription(
      trusted
        ? 'Allow a paired device to update Porcelain'
        : 'Stop a paired device from updating Porcelain',
    ),
  );
const mcp = Command.make(
  'mcp',
  {},
  Effect.fn('Cli.mcpCommand')(function* () {
    const operations = yield* CliOperations;
    yield* operations.mcp({
      dataDirectory: yield* dataDirectoryFor(yield* directory),
    });
  }),
).pipe(
  Command.withDescription('Serve MCP over the local owner socket for an agent'),
);

const shareHandler = Effect.fn('Cli.shareCommand')(function* (
  action: ShareAction,
) {
  const operations = yield* CliOperations;
  yield* finish(
    yield* operations.share({
      dataDirectory: yield* dataDirectoryFor(yield* directory),
      action,
    }),
  );
});
const share = Command.make('share', {}, () =>
  shareHandler({ kind: 'show' }),
).pipe(
  Command.withDescription('Show or manage how this server is shared'),
  Command.withSubcommands([
    Command.make('check', {}, () => shareHandler({ kind: 'check' })),
    Command.make(
      'lan',
      { mode: Argument.Literals('mode', ['on', 'off']) },
      ({ mode }) => shareHandler({ kind: 'lan', on: mode === 'on' }),
    ),
    Command.make(
      'tailscale',
      {
        hostname: Argument.String('hostname').pipe(
          Argument.withSchema(Schema.NonEmptyString),
        ),
      },
      ({ hostname }) =>
        shareHandler({
          kind: 'tailnet',
          hostname: hostname === 'off' ? undefined : hostname,
        }),
    ),
    Command.make(
      'cloudflare',
      {
        hostname: Argument.String('hostname').pipe(
          Argument.withSchema(Schema.NonEmptyString),
        ),
      },
      ({ hostname }) =>
        shareHandler({
          kind: 'cloudflare',
          hostname: hostname === 'off' ? undefined : hostname,
        }),
    ),
  ]),
);
const serviceHandler = Effect.fn('Cli.serviceCommand')(function* (input: {
  readonly action: 'install' | 'status' | 'update' | 'recover' | 'uninstall';
  readonly port: Option.Option<number>;
  readonly allowDowngrade: boolean;
}) {
  const operations = yield* CliOperations;
  const environment = yield* (yield* EnvironmentSettings).read;
  yield* operations.service({
    action: input.action,
    dataDirectory: yield* dataDirectoryFor(yield* directory),
    port: Option.getOrElse(
      input.port,
      () => environment.port ?? DEFAULT_LISTEN_PORT,
    ),
    allowDowngrade: input.allowDowngrade,
  });
});
const service = Command.make('service').pipe(
  Command.withDescription('Manage the user service'),
  Command.withSubcommands([
    Command.make('install', { port }, ({ port }) =>
      serviceHandler({
        action: 'install',
        port,
        allowDowngrade: false,
      }),
    ),
    Command.make(
      'update',
      {
        allowDowngrade: Flag.Boolean('allow-downgrade').pipe(
          Flag.withDefault(false),
        ),
      },
      ({ allowDowngrade }) =>
        serviceHandler({
          action: 'update',
          port: Option.none(),
          allowDowngrade,
        }),
    ),
    ...(['status', 'recover', 'uninstall'] as const).map((action) =>
      Command.make(action, {}, () =>
        serviceHandler({
          action,
          port: Option.none(),
          allowDowngrade: false,
        }),
      ),
    ),
  ]),
);

const help = Command.make('help', {}, (): Effect.Effect<void> =>
  GlobalFlag.Help.run(true, {
    command: porcelainCommand,
    commandPath: ['porcelain'],
    version: '0.0.0',
    builtIns: GlobalFlag.BuiltIns,
  }),
);

export const porcelainCommand = rootConfiguration.pipe(
  Command.withHandler(serveHandler),
  Command.withDescription(
    'Review coding agents’ changes from a browser, Mac or phone',
  ),
  Command.withSubcommands([
    serve,
    status,
    pair,
    devices,
    revoke,
    trustCommand('trust', true),
    trustCommand('untrust', false),
    share,
    mcp,
    service,
    help,
  ]),
);

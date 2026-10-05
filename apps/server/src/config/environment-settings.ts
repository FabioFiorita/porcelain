import { Config, Context, Effect, Layer, Option, Schema } from 'effect';
import {
  absolutePathSchema,
  listenHostSchema,
  listenPortSchema,
} from './server-settings.ts';

export type PorcelainEnvironment = {
  PATH?: string | undefined;
  PORCELAIN_DATA_DIRECTORY?: string | undefined;
  PORCELAIN_HOST?: string | undefined;
  PORCELAIN_PORT?: string | undefined;
  PORCELAIN_PROJECT_HOME?: string | undefined;
  PORCELAIN_WEB_ROOT?: string | undefined;
  PORCELAIN_ALLOWED_HOSTS?: string | undefined;
};

const optional = <A>(
  schema: Schema.ConstraintCodec<A, unknown>,
  name: string,
) =>
  Config.schema(schema, name).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
  );

const configuration = Config.all({
  dataDirectory: optional(absolutePathSchema, 'PORCELAIN_DATA_DIRECTORY'),
  host: optional(listenHostSchema, 'PORCELAIN_HOST'),
  port: optional(listenPortSchema, 'PORCELAIN_PORT'),
  projectHome: optional(absolutePathSchema, 'PORCELAIN_PROJECT_HOME'),
  webRoot: optional(absolutePathSchema, 'PORCELAIN_WEB_ROOT'),
  allowedHosts: Config.String('PORCELAIN_ALLOWED_HOSTS').pipe(
    Config.option,
    Config.map((hosts) =>
      Option.isSome(hosts) ? hosts.value.split(',').filter(Boolean) : [],
    ),
  ),
});

type Settings = {
  readonly dataDirectory: string | undefined;
  readonly host: string | undefined;
  readonly port: number | undefined;
  readonly projectHome: string | undefined;
  readonly webRoot: string | undefined;
  readonly allowedHosts: readonly string[];
};

export class EnvironmentSettings extends Context.Service<
  EnvironmentSettings,
  {
    readonly read: Effect.Effect<
      Settings,
      Config.ConfigError | Schema.SchemaError
    >;
  }
>()('@porcelain/server/EnvironmentSettings') {
  static readonly layer = Layer.succeed(this, {
    read: Effect.gen(function* () {
      const settings = yield* configuration;
      const allowedHosts = yield* Schema.decodeUnknownEffect(
        Schema.Array(listenHostSchema),
      )(settings.allowedHosts);
      return { ...settings, allowedHosts };
    }),
  });
}

import { z } from 'zod';
import { ServeConfigurationError } from './errors/serve-configuration-error.ts';
import { absolutePathSchema, listenHostSchema } from './server-settings.ts';

export const defaultListenHost = '127.0.0.1';
export const defaultListenPort = 3000;
export const defaultDataDirectoryName = '.porcelain';

export const listenPortSchema = z.number().int().min(0).max(65535);

export const startupSettingsSchema = z.object({
  dataDirectory: absolutePathSchema,
  projectHome: absolutePathSchema,
  port: listenPortSchema,
  host: listenHostSchema.default(defaultListenHost),
  webRoot: absolutePathSchema.optional(),
  allowedHosts: z.array(listenHostSchema).default([]),
});

export type StartupSettingsInput = z.input<typeof startupSettingsSchema>;

export type PorcelainEnvironment = {
  PORCELAIN_DATA_DIRECTORY?: string | undefined;
  PORCELAIN_HOST?: string | undefined;
  PORCELAIN_PORT?: string | undefined;
  PORCELAIN_PROJECT_HOME?: string | undefined;
  PORCELAIN_WEB_ROOT?: string | undefined;
  PORCELAIN_ALLOWED_HOSTS?: string | undefined;
};

export type EnvironmentSettings = {
  dataDirectory: string | undefined;
  host: string | undefined;
  port: number | undefined;
  projectHome: string | undefined;
  webRoot: string | undefined;
  allowedHosts: string[];
};

const portText = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(listenPortSchema);

function setting<Schema extends z.ZodType>(
  value: string | undefined,
  schema: Schema,
  problem: string,
): z.output<Schema> | undefined {
  if (!value) return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ServeConfigurationError(problem);
  return parsed.data;
}

export function readEnvironmentSettings(
  environment: PorcelainEnvironment,
): EnvironmentSettings {
  const absolutePath = (name: keyof PorcelainEnvironment) =>
    setting(
      environment[name],
      absolutePathSchema,
      `${name} must be an absolute path`,
    );
  return {
    dataDirectory: absolutePath('PORCELAIN_DATA_DIRECTORY'),
    host: setting(
      environment.PORCELAIN_HOST,
      listenHostSchema,
      'PORCELAIN_HOST must be a valid IP address or hostname',
    ),
    port: setting(
      environment.PORCELAIN_PORT,
      portText,
      'PORCELAIN_PORT must be an integer from 0 to 65535',
    ),
    projectHome: absolutePath('PORCELAIN_PROJECT_HOME'),
    webRoot: absolutePath('PORCELAIN_WEB_ROOT'),
    allowedHosts:
      setting(
        environment.PORCELAIN_ALLOWED_HOSTS,
        z
          .string()
          .transform((hosts) => hosts.split(',').filter(Boolean))
          .pipe(z.array(listenHostSchema)),
        'PORCELAIN_ALLOWED_HOSTS must list valid host names separated by commas',
      ) ?? [],
  };
}

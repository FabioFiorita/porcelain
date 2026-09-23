import { homedir } from 'node:os';
import { z } from 'zod';
import { absolutePathSchema, listenHostSchema } from './server-settings.ts';

export const startupSettingsSchema = z.object({
  dataDirectory: absolutePathSchema,
  projectHome: absolutePathSchema,
  port: z.number().int().min(0).max(65535),
  host: listenHostSchema.default('127.0.0.1'),
  webRoot: absolutePathSchema.optional(),
  allowedHosts: z.array(listenHostSchema).default([]),
});

export function readStartupSettings(environment: NodeJS.ProcessEnv) {
  return startupSettingsSchema.parse({
    dataDirectory: environment.PORCELAIN_DATA_DIRECTORY,
    projectHome: environment.PORCELAIN_PROJECT_HOME ?? homedir(),
    port: /^\d+$/.test(environment.PORCELAIN_PORT ?? '')
      ? Number(environment.PORCELAIN_PORT)
      : undefined,
    host: environment.PORCELAIN_HOST,
    webRoot: environment.PORCELAIN_WEB_ROOT,
    allowedHosts: environment.PORCELAIN_ALLOWED_HOSTS
      ? environment.PORCELAIN_ALLOWED_HOSTS.split(',').filter(
          (host) => host.length > 0,
        )
      : undefined,
  });
}

import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { serverSettingsSchema } from './server-settings.ts';

export const startupSettingsSchema = serverSettingsSchema.extend({
  dataDirectory: z
    .string()
    .refine((path) => isAbsolute(path) && !path.includes('\0')),
  port: z.number().int().min(0).max(65535),
});

export function readStartupSettings(environment: NodeJS.ProcessEnv) {
  return startupSettingsSchema.parse({
    dataDirectory: environment.PORCELAIN_DATA_DIRECTORY,
    token: environment.PORCELAIN_TOKEN,
    port: /^\d+$/.test(environment.PORCELAIN_PORT ?? '')
      ? Number(environment.PORCELAIN_PORT)
      : undefined,
  });
}

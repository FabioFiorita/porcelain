import { z } from 'zod';
import {
  absolutePathSchema,
  listenHostSchema,
  serverSettingsSchema,
} from './server-settings.ts';

export const startupSettingsSchema = serverSettingsSchema.extend({
  dataDirectory: absolutePathSchema,
  port: z.number().int().min(0).max(65535),
  host: listenHostSchema.default('127.0.0.1'),
  webRoot: absolutePathSchema.optional(),
});

export function readStartupSettings(environment: NodeJS.ProcessEnv) {
  return startupSettingsSchema.parse({
    dataDirectory: environment.PORCELAIN_DATA_DIRECTORY,
    token: environment.PORCELAIN_TOKEN,
    port: /^\d+$/.test(environment.PORCELAIN_PORT ?? '')
      ? Number(environment.PORCELAIN_PORT)
      : undefined,
    host: environment.PORCELAIN_HOST,
    webRoot: environment.PORCELAIN_WEB_ROOT,
  });
}

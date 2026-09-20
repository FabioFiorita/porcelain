import { homedir } from 'node:os';
import { z } from 'zod';
import {
  absolutePathSchema,
  listenHostSchema,
  serverSettingsSchema,
} from './server-settings.ts';

export const startupSettingsSchema = serverSettingsSchema.extend({
  dataDirectory: absolutePathSchema,
  /** Where project discovery and folder browsing start. */
  projectHome: absolutePathSchema,
  port: z.number().int().min(0).max(65535),
  host: listenHostSchema.default('127.0.0.1'),
  webRoot: absolutePathSchema.optional(),
  /** Host names this server answers to beyond loopback and its own address. */
  allowedHosts: z.array(listenHostSchema).default([]),
});

/**
 * The raw development entry point is a composition root, so it is one of the
 * few places allowed to resolve a default home directory.
 */
export function readStartupSettings(environment: NodeJS.ProcessEnv) {
  return startupSettingsSchema.parse({
    dataDirectory: environment.PORCELAIN_DATA_DIRECTORY,
    projectHome: environment.PORCELAIN_PROJECT_HOME ?? homedir(),
    token: environment.PORCELAIN_TOKEN,
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

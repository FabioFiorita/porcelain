import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { ServeConfigurationError } from './errors/serve-configuration-error.ts';
import { LIMITS, type Limits } from './limits.ts';

const HOSTNAME_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export const DEFAULT_LISTEN_HOST = '127.0.0.1';
export const DEFAULT_LISTEN_PORT = 3000;
export const DEFAULT_DATA_DIRECTORY_NAME = '.porcelain';

function isValidListenHost(host: string) {
  if (host.length > 253 || host !== host.trim() || host.includes('\0'))
    return false;
  if (isIP(host) !== 0) return true;
  const labels = host.split('.');
  if (labels.length === 4 && labels.every((label) => /^\d+$/.test(label)))
    return false;
  return labels.every((label) => HOSTNAME_LABEL.test(label));
}

export const absolutePathSchema = z
  .string()
  .refine((path) => isAbsolute(path))
  .refine((path) => !path.includes('\0'));

export const listenHostSchema = z
  .string()
  .refine(isValidListenHost, 'Host must be a valid IP address or hostname');

export const listenPortSchema = z.number().int().min(0).max(65535);

const serverSettingsSchema = z.object({
  dataDirectory: absolutePathSchema,
  projectHome: absolutePathSchema,
  host: listenHostSchema.default(DEFAULT_LISTEN_HOST),
  port: listenPortSchema.default(DEFAULT_LISTEN_PORT),
  webRoot: absolutePathSchema.optional(),
  allowedHosts: z.array(listenHostSchema).default([]),
});

export type ServerSettingsInput = z.input<typeof serverSettingsSchema>;

export type ServerSettings = z.output<typeof serverSettingsSchema> & {
  limits: Limits;
};

export function readServerSettings(input: ServerSettingsInput): ServerSettings {
  const parsed = serverSettingsSchema.safeParse(input);
  if (!parsed.success)
    throw new ServeConfigurationError(
      `Invalid server settings: ${parsed.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  return { ...parsed.data, limits: LIMITS };
}

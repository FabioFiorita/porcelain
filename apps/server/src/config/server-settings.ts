import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const hostnameLabel = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isValidListenHost(host: string) {
  if (host.length > 253 || host !== host.trim() || host.includes('\0'))
    return false;
  if (isIP(host) !== 0) return true;
  const labels = host.split('.');
  if (labels.length === 4 && labels.every((label) => /^\d+$/.test(label)))
    return false;
  return labels.every((label) => hostnameLabel.test(label));
}

export const absolutePathSchema = z
  .string()
  .refine((path) => isAbsolute(path))
  .refine((path) => !path.includes('\0'));

export const listenHostSchema = z
  .string()
  .refine(isValidListenHost, 'Host must be a valid IP address or hostname');

export const serverSettingsSchema = z.object({
  token: z
    .string()
    .min(32)
    .regex(/^[A-Za-z0-9._~-]+$/),
});

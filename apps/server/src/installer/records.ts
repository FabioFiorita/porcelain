import { z } from 'zod';
import { InvalidInstalledRecordError } from './errors/invalid-installed-record-error.ts';
import { InvalidServiceConfigurationError } from './errors/invalid-service-configuration-error.ts';
import { InvalidUpdateJournalError } from './errors/invalid-update-journal-error.ts';
import { readJsonFile } from './json-file.ts';

export const serviceConfigurationSchema = z.object({
  dataDirectory: z.string(),
  host: z.string(),
  port: z.number().int(),
  allowedHosts: z.array(z.string()),
});
export type ServiceConfiguration = z.output<typeof serviceConfigurationSchema>;

export const installedRecordSchema = z.object({ version: z.string() });
export type InstalledRecord = z.output<typeof installedRecordSchema>;

export const updateJournalSchema = z.object({
  installed: installedRecordSchema,
  backup: z.string(),
});
export type UpdateJournal = z.output<typeof updateJournalSchema>;

export const lockOwnerSchema = z.object({
  pid: z.number().int(),
  createdAt: z.string(),
  token: z.string(),
});

export const packageManifestSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
});

export async function readInstalledRecord(
  path: string,
): Promise<InstalledRecord | undefined> {
  const file = await readJsonFile(path, installedRecordSchema);
  if (file.kind === 'invalid') throw new InvalidInstalledRecordError();
  return file.kind === 'value' ? file.value : undefined;
}

export async function readServiceConfiguration(
  path: string,
): Promise<ServiceConfiguration> {
  const file = await readJsonFile(path, serviceConfigurationSchema);
  if (file.kind !== 'value') throw new InvalidServiceConfigurationError();
  return file.value;
}

export async function readUpdateJournal(
  path: string,
): Promise<UpdateJournal | undefined> {
  const file = await readJsonFile(path, updateJournalSchema);
  if (file.kind === 'invalid') throw new InvalidUpdateJournalError(path);
  return file.kind === 'value' ? file.value : undefined;
}

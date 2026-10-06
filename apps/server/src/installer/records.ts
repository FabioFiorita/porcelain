import { Schema } from 'effect';
import { InvalidInstalledRecordError } from './errors/invalid-installed-record-error.ts';
import { InvalidServiceConfigurationError } from './errors/invalid-service-configuration-error.ts';
import { InvalidUpdateJournalError } from './errors/invalid-update-journal-error.ts';
import { readJsonFile } from './json-file.ts';
const serviceConfigurationSchema = Schema.Struct({
  dataDirectory: Schema.String,
  port: Schema.Finite.check(Schema.isInt()),
  host: Schema.optional(Schema.String),
});
export type ServiceConfiguration = typeof serviceConfigurationSchema.Type;
const installedRecordSchema = Schema.Struct({
  version: Schema.String,
});
export type InstalledRecord = typeof installedRecordSchema.Type;
const updateJournalSchema = Schema.Struct({
  installed: installedRecordSchema,
  backup: Schema.String,
  target: Schema.optional(Schema.String),
  healthy: Schema.optional(Schema.Boolean),
});
export type UpdateJournal = typeof updateJournalSchema.Type;
const updateRecordSchema = Schema.Struct({
  from: Schema.String,
  target: Schema.String,
  stage: Schema.Literals([
    'downloading',
    'installing',
    'restarting',
    'updated',
    'failed',
  ]),
  reason: Schema.optional(Schema.String),
});
export type UpdateRecord = typeof updateRecordSchema.Type;
export const packageManifestSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
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
export async function readUpdateRecord(
  path: string,
): Promise<UpdateRecord | undefined> {
  const file = await readJsonFile(path, updateRecordSchema);
  return file.kind === 'value' ? file.value : undefined;
}
export async function readUpdateJournal(
  path: string,
): Promise<UpdateJournal | undefined> {
  const file = await readJsonFile(path, updateJournalSchema);
  if (file.kind === 'invalid') throw new InvalidUpdateJournalError(path);
  return file.kind === 'value' ? file.value : undefined;
}

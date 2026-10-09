import { Schema } from 'effect';
import { join } from 'node:path';
import { buildIdentity, shellCommand } from '../../verify-core/connection.ts';
import {
  Registry,
  repositoryRoot as root,
  type Instance,
} from '../../verify-core/registry.ts';

const remoteSchema = Schema.Struct({
  manifest: Schema.String,
  address: Schema.String,
  repository: Schema.String,
});
const detailSchema = Schema.Struct({
  web: Schema.String,
  address: Schema.String,
  environmentId: Schema.String,
  projectId: Schema.String,
  worktreeId: Schema.String,
  ownerSocketPath: Schema.String,
  serverDataDirectory: Schema.String,
  credentialFiles: Schema.Record(Schema.String, Schema.String),
  repository: Schema.String,
  projectHome: Schema.String,
  desktop: Schema.Boolean,
  manifest: Schema.String,
  remote: Schema.optional(remoteSchema),
});
export const registry = new Registry({
  name: 'web',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: detailSchema,
  inputs: { roots: [], apps: [] },
  format: 'json',
  connection: webConnection,
  stale: (instance, changed) =>
    changed
      ? `The server or CLI code changed since instance ${instance.id} started; Vite reloads web and client code, but this change needs stop and start.`
      : undefined,
  stopWithinMs: 20_000,
});
export type WebInstance = Instance<typeof detailSchema.Type>;
function webConnection(instance: WebInstance) {
  const { detail } = instance;
  const cli = join(root, '.agents/skills/web-verify/scripts/cli');
  const command = (name: string) =>
    shellCommand([cli, name, '--instance', instance.id]);
  return {
    instanceId: instance.id,
    surface: 'web' as const,
    build: {
      ...buildIdentity(root),
      sourceFingerprint: instance.fingerprint,
      startedAt: instance.startedAt,
    },
    fixtures: {
      environmentId: detail.environmentId,
      projectId: detail.projectId,
      worktreeId: detail.worktreeId,
      repositoryPath: detail.repository,
      projectHome: detail.projectHome,
    },
    serverUrl: detail.address,
    webUrl: detail.web,
    webSocketUrl: new URL('/api/live', detail.web).href.replace(/^http/, 'ws'),
    requiredOrigin: { http: detail.web, webSocket: detail.web },
    ownerSocketPath: detail.ownerSocketPath,
    serverDataDirectory: detail.serverDataDirectory,
    credentialFiles: detail.credentialFiles,
    pairing: { command: command('pairing-link') },
    mcp: {
      command: `cd ${shellCommand([detail.repository])} && ${shellCommand([process.execPath, join(root, 'scripts/server.ts'), '--data-directory', detail.serverDataDirectory, 'mcp'])}`,
    },
    evidenceDirectory: instance.evidence,
    statusCommand: command('status'),
    logsCommand: command('logs'),
    stopCommand: command('stop'),
    webMode: detail.desktop ? 'desktop' : 'test',
    initialRoute: `/${detail.projectId}/${detail.worktreeId}`,
    remote: {
      startCommand: shellCommand([
        cli,
        'remote',
        'start',
        '--instance',
        instance.id,
      ]),
    },
  };
}

import { Schema } from 'effect';
import { join } from 'node:path';
import { buildIdentity, shellCommand } from '../../verify-core/connection.ts';
import {
  Registry,
  repositoryRoot,
  type Instance,
} from '../../verify-core/registry.ts';
export const STALE_BUILD =
  'server or CLI code changed since start, run start again';
const detailSchema = Schema.Struct({
  address: Schema.String,
  manifestPath: Schema.String,
  environmentId: Schema.String,
  ownerSocketPath: Schema.String,
  serverDataDirectory: Schema.String,
  credentialFiles: Schema.Record(Schema.String, Schema.String),
  routes: Schema.Array(Schema.String),
  projectId: Schema.String,
  worktreeId: Schema.String,
  repository: Schema.String,
  projectHome: Schema.String,
  logFile: Schema.String,
});
export type ServerInstance = Instance<typeof detailSchema.Type>;
export const registry = new Registry({
  name: 'server',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: detailSchema,
  inputs: { roots: [], apps: [] },
  format: 'json',
  connection: serverConnection,
  stale: (_instance, changed) => (changed ? STALE_BUILD : undefined),
  stopWithinMs: 15_000,
});

function serverConnection(instance: ServerInstance) {
  const { detail } = instance;
  const cli = join(repositoryRoot, '.agents/skills/server-verify/scripts/cli');
  const command = (name: string) =>
    shellCommand([cli, name, '--instance', instance.id]);
  const publicRoutes = new Set([
    'GET /api/health',
    'GET /api/environment',
    'POST /api/pair',
    'DELETE /api/session',
  ]);
  return {
    instanceId: instance.id,
    surface: 'server' as const,
    build: {
      ...buildIdentity(repositoryRoot),
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
    webUrl: detail.address,
    webSocketUrl: new URL('/api/live', detail.address).href.replace(
      /^http/,
      'ws',
    ),
    requiredOrigin: {
      http: new URL(detail.address).origin,
      webSocket: new URL(detail.address).origin,
    },
    ownerSocketPath: detail.ownerSocketPath,
    serverDataDirectory: detail.serverDataDirectory,
    credentialFiles: detail.credentialFiles,
    pairing: { command: command('pairing-link') },
    mcp: {
      command: `cd ${shellCommand([detail.repository])} && ${shellCommand([process.execPath, join(repositoryRoot, 'scripts/server.ts'), '--data-directory', detail.serverDataDirectory, 'mcp'])}`,
    },
    evidenceDirectory: instance.evidence,
    statusCommand: command('status'),
    logsCommand: command('logs'),
    stopCommand: command('stop'),
    routes: {
      owner: detail.routes
        .filter((route) => route.startsWith('owner '))
        .map((route) => route.slice(6)),
      public: detail.routes.filter((route) => publicRoutes.has(route)),
      paired: detail.routes.filter(
        (route) =>
          !route.startsWith('owner ') &&
          !publicRoutes.has(route) &&
          /^[A-Z]+ \/api\//.test(route),
      ),
    },
    live: {
      protocolExample: {
        notices: {
          _tag: 'Request',
          id: '1',
          tag: 'notices',
          payload: null,
          headers: [],
        },
        follow: {
          _tag: 'Request',
          id: '2',
          tag: 'follow',
          payload: {
            projects: [detail.projectId],
            worktrees: [
              {
                projectId: detail.projectId,
                worktreeId: detail.worktreeId,
                paths: ['README.md'],
              },
            ],
          },
          headers: [],
        },
        chunk: { _tag: 'Chunk', requestId: '1', values: [{ type: 'ready' }] },
        ack: { _tag: 'Ack', requestId: '1' },
      },
    },
  };
}

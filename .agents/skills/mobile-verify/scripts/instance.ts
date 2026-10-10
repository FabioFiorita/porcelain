import { Schema } from 'effect';
import { join } from 'node:path';
import {
  nativeFingerprint,
  identity,
} from '@porcelain/mobile/kit/development-client';
import {
  buildIdentity,
  connectionSchema,
  shellCommand,
} from '../../verify-core/connection.ts';
import {
  Registry,
  repositoryRoot,
  type Instance,
} from '../../verify-core/registry.ts';

const remoteSchema = Schema.Struct({
  hub: Schema.String,
  tokenVariable: Schema.String,
  ports: Schema.Array(Schema.Finite),
  ssh: Schema.optional(Schema.String),
  checkout: Schema.optional(Schema.String),
});
export const optionsSchema = Schema.Struct({
  kind: Schema.Literals(['iphone', 'ipad']),
  host: Schema.NullOr(remoteSchema),
  agentConfig: Schema.optional(Schema.String),
  agentCommand: Schema.optional(Schema.String),
  simulatorLimit: Schema.Finite,
  udid: Schema.optional(Schema.String),
});
const detailSchema = Schema.Struct({
  ...optionsSchema.fields,
  udid: Schema.String,
  simulator: Schema.String,
  session: Schema.String,
  borrowed: Schema.Boolean,
  installed: Schema.Boolean,
  metro: Schema.String,
  server: Schema.String,
  manifest: Schema.String,
  repository: Schema.String,
  native: Schema.String,
  environmentId: Schema.String,
  environmentName: Schema.String,
  projectId: Schema.String,
  worktreeId: Schema.String,
  projectHome: Schema.String,
  ownerSocketPath: Schema.String,
  serverDataDirectory: Schema.String,
  credentialFile: Schema.String,
  driver: Schema.Struct({
    launcher: Schema.String,
    config: Schema.String,
    targetArgs: Schema.Array(Schema.String),
    command: Schema.String,
  }),
});
export const mobileConnectionSchema = Schema.Struct({
  ...connectionSchema.fields,
  mobile: Schema.Struct({
    platform: Schema.Literal('ios'),
    udid: Schema.String,
    simulator: Schema.String,
    bundleIdentifier: Schema.String,
    metroUrl: Schema.String,
    environmentName: Schema.String,
    borrowed: Schema.Boolean,
    installed: Schema.Boolean,
    agentDevice: detailSchema.fields.driver,
  }),
});
export type MobileInstance = Instance<typeof detailSchema.Type>;
export const registry = new Registry({
  name: 'mobile',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: detailSchema,
  inputs: { roots: ['apps/mobile/spec/kit'], apps: [] },
  format: 'text',
  connection: mobileConnection,
  stale: async (instance, changed) => {
    if ((await nativeFingerprint()) !== instance.detail.native)
      return 'Native inputs changed; stop, build the matching development client on the Mac, then start again.';
    return changed
      ? 'Server or CLI code changed; stop and start again.'
      : undefined;
  },
  stopWithinMs: 60_000,
});
function mobileConnection(instance: MobileInstance) {
  const { detail } = instance;
  const cli = join(repositoryRoot, '.agents/skills/mobile-verify/scripts/cli');
  const command = (name: string) =>
    shellCommand([cli, name, '--instance', instance.id]);
  return {
    instanceId: instance.id,
    surface: 'mobile' as const,
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
    serverUrl: detail.server,
    webUrl: detail.server,
    webSocketUrl: new URL('/api/live', detail.server).href.replace(
      /^http/,
      'ws',
    ),
    requiredOrigin: { http: detail.server, webSocket: detail.server },
    ownerSocketPath: detail.ownerSocketPath,
    serverDataDirectory: detail.serverDataDirectory,
    credentialFiles: {
      fixture: detail.credentialFile,
      agentDevice: detail.driver.config,
    },
    pairing: { command: command('pairing-link') },
    mcp: {
      command: `cd ${shellCommand([detail.repository])} && ${shellCommand([process.execPath, join(repositoryRoot, 'scripts/server.ts'), '--data-directory', detail.serverDataDirectory, 'mcp'])}`,
    },
    evidenceDirectory: instance.evidence,
    statusCommand: command('status'),
    logsCommand: command('logs'),
    stopCommand: command('stop'),
    mobile: {
      platform: 'ios' as const,
      udid: detail.udid,
      simulator: detail.simulator,
      bundleIdentifier: identity.bundleIdentifier,
      metroUrl: detail.metro,
      environmentName: detail.environmentName,
      borrowed: detail.borrowed,
      installed: detail.installed,
      agentDevice: detail.driver,
    },
  };
}

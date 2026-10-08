import { Schema } from 'effect';
import { execFileSync } from 'node:child_process';

const command = Schema.Struct({ command: Schema.String });
export const connectionSchema = Schema.Struct({
  instanceId: Schema.String,
  surface: Schema.Literals(['server', 'web', 'desktop', 'mobile']),
  build: Schema.Struct({
    commit: Schema.NullOr(Schema.String),
    dirty: Schema.NullOr(Schema.Boolean),
    sourceFingerprint: Schema.String,
    startedAt: Schema.String,
  }),
  fixtures: Schema.Struct({
    environmentId: Schema.String,
    projectId: Schema.String,
    worktreeId: Schema.String,
    repositoryPath: Schema.String,
    projectHome: Schema.String,
  }),
  serverUrl: Schema.String,
  webUrl: Schema.String,
  webSocketUrl: Schema.String,
  requiredOrigin: Schema.Struct({
    http: Schema.String,
    webSocket: Schema.String,
  }),
  ownerSocketPath: Schema.String,
  serverDataDirectory: Schema.String,
  credentialFiles: Schema.Record(Schema.String, Schema.String),
  pairing: command,
  mcp: command,
  evidenceDirectory: Schema.String,
  statusCommand: Schema.String,
  logsCommand: Schema.String,
  stopCommand: Schema.String,
});
export type Connection = typeof connectionSchema.Type;

export function shellCommand(args: readonly string[]): string {
  return args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(' ');
}

export function buildIdentity(root: string) {
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    return {
      commit: git('rev-parse', 'HEAD'),
      dirty: git('status', '--porcelain') !== '',
    };
  } catch {
    return { commit: null, dirty: null };
  }
}

export function connectionCard(connection: Connection, path: string): string {
  return `instance ${connection.instanceId}\nserver ${connection.serverUrl}\nweb ${connection.webUrl}\nwebsocket ${connection.webSocketUrl}\nconnection ${path}\npair ${connection.pairing.command}\nmcp ${connection.mcp.command}\nevidence ${connection.evidenceDirectory}\nstop ${connection.stopCommand}\n`;
}

import { pairingLink } from '@porcelain/contracts/access';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { REMOTE_COMPUTER_NAME } from '../../../../apps/server/spec/kit/remote-computer.ts';
import {
  optionalDrivers,
  Refusal,
  runCli,
  stopOutput,
  sandboxProblems,
  Usage,
} from '../../verify-core/cli.ts';
import {
  agentCommand,
  issuedLink,
  serverOptions,
  serverRead,
} from '../../verify-core/fixtures.ts';
import { registry, type WebInstance } from './instance.ts';
import { start, serve, vite, remoteRequest, remoteFailed } from './start.ts';

const remoteReadyMs = 90 * 1000;
const remotePollMs = 200;
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--desktop] [--coding-tool]
                          start a disposable server and Vite; print the connection card
  doctor                  check startup dependencies; list optional browser drivers
  status                  inspect captured ownership, build staleness and connection metadata
  logs                    print redacted server and Vite output
  stop                    stop owned processes; keep evidence
  evidence                print the retained evidence folder
  pairing-link            mint a fresh one-time link to open in your browser
  agent publish-review "<title>" [--context] [--summary-html <html>]
  agent publish-proof "<title>" --check "<name>=pass|fail|skipped" [--output "<name>=<text>"] --screenshot "<title>"
  agent comment <path> "<body>" | reply <threadId|latest> "<body>"
  server published-review | reviewed-files [<branch ref>] | reviewed-layers | comment-threads | project | devices | pending-links | receipt <requestId>
  remote start            start a second disposable computer
  remote pairing-link [--trusted]
                          mint a link for that computer; agent/server accept --remote
Drive the browser with your own tools. Startup neither opens nor pairs a browser.
`;
async function doctor(): Promise<string> {
  const sandbox = sandboxProblems();
  if (sandbox.length > 0 || !existsSync(vite)) process.exitCode = 1;
  const checks = [
    `node ${process.versions.node}`,
    ...(sandbox.length > 0 ? sandbox : ['server sandbox and Git: ready']),
    `Vite: ${existsSync(vite) ? 'ready' : 'missing; run pnpm install --frozen-lockfile'}`,
    'Optional drivers (not required for startup): harness browser, project Playwright MCP, pnpm exec playwright cli',
    ...optionalDrivers(),
  ];
  const live = registry
    .list()
    .filter((entry) => entry.alive)
    .map(
      ({ instance }) =>
        `${instance.id} ${instance.detail.web}${instance.detail.desktop ? ' (desktop)' : ''}`,
    );
  return `${checks.join('\n')}\nlive instances: ${live.join(', ') || 'none'}\n`;
}
function remoteOf(instance: WebInstance) {
  const { remote } = instance.detail;
  if (remote === undefined)
    throw new Refusal('No second computer runs yet; run remote start first.');
  return remote;
}
async function remoteStart(instance: WebInstance): Promise<string> {
  const describe = (remote: NonNullable<WebInstance['detail']['remote']>) =>
    `remote computer ${REMOTE_COMPUTER_NAME}, project remote-sample\nremote address ${remote.address}\nremote repository ${remote.repository}\n`;
  if (instance.detail.remote !== undefined)
    return `already running\n${describe(instance.detail.remote)}`;
  const failed = join(instance.folder, remoteFailed);
  writeFileSync(join(instance.folder, remoteRequest), '');
  const deadline = Date.now() + remoteReadyMs;
  while (Date.now() < deadline) {
    if (existsSync(failed))
      throw new Refusal(
        `the second computer did not start: ${readFileSync(failed, 'utf8').trim()}`,
      );
    const remote = registry
      .list()
      .find((entry) => entry.instance.id === instance.id)?.instance
      .detail.remote;
    if (remote !== undefined) return describe(remote);
    await sleep(remotePollMs);
  }
  throw new Refusal(
    `the second computer did not start within ${remoteReadyMs / 1000} s; read supervisor.log`,
  );
}
type ServerSideValues = Parameters<typeof agentCommand>[2] & {
  remote: boolean;
  trusted: boolean;
};
async function serverSide(
  instance: WebInstance,
  name: string,
  rest: readonly string[],
  values: ServerSideValues,
  args: readonly string[],
): Promise<string | undefined> {
  const manifest = () =>
    values.remote ? remoteOf(instance).manifest : instance.detail.manifest;
  const recorder = registry.redactor(instance).recorder();
  const record = async (label: string, output: string) => {
    await registry
      .evidence(instance)
      .json(label, { command: args, output }, recorder);
    return registry.redactor(instance).known(output);
  };
  if (name === 'agent')
    return record(
      `agent-${rest[0] ?? ''}`,
      await agentCommand(manifest(), rest, values, recorder),
    );
  if (name === 'server')
    return record(
      `server-${rest[0] ?? ''}`,
      await serverRead(manifest(), rest, recorder),
    );
  if (name === 'pairing-link') {
    const grant = await issuedLink(
      instance.detail.manifest,
      'Verification browser',
      false,
      recorder,
    );
    const link = `${instance.detail.web}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`;
    return record('pairing-link', `${link}\n`);
  }
  if (name === 'remote' && rest[0] === 'start')
    return record('remote-start', await remoteStart(instance));
  if (name === 'remote' && rest[0] === 'pairing-link') {
    const grant = await issuedLink(
      remoteOf(instance).manifest,
      'Remote computer',
      values.trusted,
      recorder,
    );
    const link = pairingLink({
      addresses: [grant.address],
      code: grant.code,
      environmentId: grant.environmentId,
    });
    return record('remote-pairing-link', `${link}\n`);
  }
  return undefined;
}
async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      instance: { type: 'string' },
      ...serverOptions,
      desktop: { type: 'boolean', default: false },
      'coding-tool': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start')
    return start({
      desktop: values.desktop,
      codingTool: values['coding-tool'],
    });
  if (name === 'doctor') return doctor();
  if (name === undefined) throw new Usage(usage);
  if (name === 'stop') {
    const result = await registry.stopById(values.instance);
    return stopOutput(result);
  }
  if (name === 'evidence') return `${registry.evidencePath(values.instance)}\n`;
  if (name === 'status')
    return `${JSON.stringify(await registry.status(values.instance), null, 2)}\n`;
  if (!['logs', 'agent', 'server', 'pairing-link', 'remote'].includes(name))
    throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  if (name === 'logs')
    return registry
      .redactor(instance)
      .text(
        (
          await Promise.all(
            ['server.log', 'vite.log', 'supervisor.log'].map((file) =>
              readFile(join(instance.evidence, file), 'utf8'),
            ),
          )
        ).join('\n'),
      );
  return registry.drive(instance, args, async () => {
    const output = await serverSide(instance, name, rest, values, args);
    if (output === undefined) throw new Usage(usage);
    return output;
  });
}
await runCli(command);

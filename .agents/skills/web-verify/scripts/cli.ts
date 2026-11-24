import { pairingLink } from '@porcelain/contracts/access';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { REMOTE_COMPUTER_NAME } from '@porcelain/server/kit/remote-computer';
import {
  optionalDrivers,
  Refusal,
  runCli,
  stopOutput,
  sandboxProblems,
  Usage,
} from '../../verify-core/cli.ts';
import {
  issuedLink,
  serverOptions,
  serverRead,
} from '../../verify-core/fixtures.ts';
import { registry, type WebInstance } from './instance.ts';
import { start, serve, vp, remoteRequest, remoteFailed } from './start.ts';

const remoteReadyMs = 90 * 1000;
const remotePollMs = 200;
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--browser-fixture] [--desktop] [--coding-tool] [--walkthrough-sample] [--git-interruption]
                          start a disposable server and Vite+; print the card and optional one-time browser fixture URL
  doctor                  check startup dependencies; list optional browser drivers
  status                  inspect captured ownership, build staleness and connection metadata
  logs                    print redacted server and Vite output
  stop                    stop owned processes; keep evidence
  evidence                print the retained evidence folder
  pairing-link            mint a fresh one-time link to open in your browser
  sweep <route|feature map> [--board <png>] ...
                          capture each route at 1440, 1080 and 414, light and dark, as-is
                          and with the long-text and many-items seeds; write index.md; fail
                          on a page or console error, an HTTP failure, a redirect,
                          horizontal overflow or a theme that did not apply
  board-diff --board <name> --route <path> [--width 1440,414] [--theme light,dark]
             [--board-directory <folder>]
                          compare mapped roles with approved HTML; write Markdown and JSON;
                          fail on style mismatches, missing roles or unavailable pages
  server reviewed-files [<branch ref>] | project | devices | pending-links | receipt <requestId>
  remote start            start a second disposable computer
  remote pairing-link [--trusted]
                          mint a link for that computer; server accepts --remote
Drive the browser with your own tools. Open the browser fixture URL in a fresh browser context.
`;
async function doctor(): Promise<string> {
  const sandbox = sandboxProblems();
  if (sandbox.length > 0 || !existsSync(vp)) process.exitCode = 1;
  const checks = [
    `node ${process.versions.node}`,
    ...(sandbox.length > 0 ? sandbox : ['server sandbox and Git: ready']),
    `Vite+: ${existsSync(vp) ? 'ready' : 'missing; run pnpm install --frozen-lockfile'}`,
    'Optional drivers (not required for startup): harness browser, project Playwright MCP, pnpm exec playwright cli',
    ...optionalDrivers(),
  ];
  const live = registry.doctorInstances(
    ({ id, detail }) =>
      `${id} ${detail.web}${detail.desktop ? ' (desktop)' : ''}`,
  );
  return `${checks.join('\n')}\n${live}\n`;
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
async function browserFixtureLink(
  instance: WebInstance,
  args: readonly string[],
): Promise<string> {
  const recorder = registry.redactor(instance).recorder();
  const grant = await issuedLink(
    instance.detail.manifest,
    'Verification browser',
    false,
    recorder,
  );
  const link = `${instance.detail.web}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`;
  await registry
    .evidence(instance)
    .json('pairing-link', { command: args, output: link }, recorder);
  return link;
}

type ServerSideValues = {
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
  if (name === 'pairing-link')
    return `${await browserFixtureLink(instance, args)}\n`;
  const manifest = () =>
    values.remote ? remoteOf(instance).manifest : instance.detail.manifest;
  const recorder = registry.redactor(instance).recorder();
  const record = async (label: string, output: string) => {
    await registry
      .evidence(instance)
      .json(label, { command: args, output }, recorder);
    return registry.redactor(instance).known(output);
  };
  if (name === 'server')
    return record(
      `server-${rest[0] ?? ''}`,
      await serverRead(manifest(), rest, recorder),
    );
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
      'browser-fixture': { type: 'boolean', default: false },
      desktop: { type: 'boolean', default: false },
      'coding-tool': { type: 'boolean', default: false },
      'walkthrough-sample': { type: 'boolean', default: false },
      'git-interruption': { type: 'boolean', default: false },
      board: { type: 'string', multiple: true },
      route: { type: 'string' },
      width: { type: 'string' },
      theme: { type: 'string' },
      'board-directory': { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start') {
    const { instance, card } = await start({
      desktop: values.desktop,
      codingTool: values['coding-tool'],
      walkthroughSample: values['walkthrough-sample'],
      gitInterruption: values['git-interruption'],
    });
    if (!values['browser-fixture']) return card;
    try {
      return `${card}browser fixture ${await browserFixtureLink(instance, args)}\n`;
    } catch (error) {
      const stopped = await registry.stopById(instance.id);
      if (!stopped.complete)
        throw new Refusal(
          `Could not prepare the browser fixture. Stop incomplete for ${instance.id}; evidence: ${instance.evidence}`,
        );
      throw error;
    }
  }
  if (name === 'doctor') return doctor();
  if (
    name === undefined ||
    (values.board !== undefined && name !== 'sweep' && name !== 'board-diff')
  )
    throw new Usage(usage);
  if (name === 'stop') {
    const result = await registry.stopById(values.instance);
    return stopOutput(result);
  }
  if (name === 'evidence') return `${registry.evidencePath(values.instance)}\n`;
  if (name === 'status')
    return `${JSON.stringify(await registry.status(values.instance), null, 2)}\n`;
  if (
    ![
      'logs',
      'server',
      'pairing-link',
      'remote',
      'sweep',
      'board-diff',
    ].includes(name)
  )
    throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  if (name === 'board-diff')
    return registry.drive(instance, args, async () => {
      const { boardDiff } = await import('./board-diff.ts');
      return boardDiff(instance, args);
    });
  if (name === 'sweep')
    return registry.drive(instance, args, async () => {
      const { sweep } = await import('./sweep.ts');
      return sweep(instance, args);
    });
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

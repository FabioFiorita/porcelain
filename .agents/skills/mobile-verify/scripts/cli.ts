import { pairingLink } from '@porcelain/contracts/access';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDevelopmentClient } from '@porcelain/mobile/kit/development-client';
import { deviceHost } from '@porcelain/mobile/kit/device-host';
import { missingTools } from '@porcelain/mobile/kit/tools';
import {
  runCli,
  refuseMissing,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import {
  agentCommand,
  issuedLink,
  serverRead,
  serverOptions,
} from '../../verify-core/fixtures.ts';
import { registry, type MobileInstance } from './instance.ts';
import { serve, start, startProblems } from './serve.ts';

const usage = `Usage: .agents/skills/mobile-verify/scripts/cli <command> [--instance <id>]
  doctor                   check startup dependencies, matching native build and active instances
  build                    build the matching development client on the Mac
  start [--device iphone|ipad] [--udid <already-owned-booted-udid>]
                           prepare and pair a disposable server, Metro and development client
  status                   report passive lifecycle status and connection metadata
  logs                     record app, Metro and server logs
  evidence                 list retained evidence
  stop                     close this run's sessions, release its simulator and stop owned processes
  pairing-link             print a fresh one-time pairing link
  agent publish-review|publish-proof|comment|reply ...
                           act through the disposable server's MCP fixture
  server published-review|reviewed-files|reviewed-layers|comment-threads|project|devices|pending-links|receipt ...
                           read back the disposable server's state
Drive the app with the pinned agent-device invocation from the connection card.
`;
async function doctor(): Promise<string> {
  const problems = (await startProblems(deviceHost().remote)).filter(
    (problem) => problem !== undefined,
  );
  if (problems.length > 0) process.exitCode = 1;
  const live = registry.list().filter((entry) => entry.alive);
  return [
    `node ${process.versions.node}`,
    ...(problems.length > 0
      ? problems.map((problem) => `FAIL ${problem}`)
      : ['ok startup dependencies and matching native build']),
    ...live.map(
      ({ instance }) =>
        `instance ${instance.id}: ${instance.detail.simulator}; connection ${instance.connectionPath}`,
    ),
    'driver: agent-device CLI (required for setup and the journey); no MCP registration needed',
    '',
  ].join('\n');
}
function logs(instance: MobileInstance): string {
  const app =
    instance.detail.host === null
      ? spawnSync(
          'xcrun',
          [
            'simctl',
            'spawn',
            instance.detail.udid,
            'log',
            'show',
            '--last',
            '10m',
            '--style',
            'compact',
            '--predicate',
            'process == "PorcelainDev" AND (subsystem BEGINSWITH "com.facebook.react" OR messageType == error OR messageType == fault)',
          ],
          { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        )
      : undefined;
  const tail = (text: string) => text.split('\n').slice(-400).join('\n');
  return [
    '## app',
    app === undefined
      ? 'Native logs stay on the Mac; Metro records JavaScript output below.'
      : tail(`${app.stdout}${app.stderr}`),
    ...['metro.log', 'server.log'].flatMap((name) => {
      const path = join(instance.evidence, name);
      return [
        `## ${name}`,
        existsSync(path) ? tail(readFileSync(path, 'utf8')) : '(none)',
      ];
    }),
    '',
  ].join('\n');
}
async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      ...serverOptions,
      instance: { type: 'string' },
      device: { type: 'string', default: 'iphone' },
      udid: { type: 'string' },
      'agent-device-config': { type: 'string' },
      'agent-device-command': { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (values.remote)
    throw new Usage(
      'Use a separate disposable server instance for a second environment; this mobile run owns one server.',
    );
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start') {
    if (values.device !== 'iphone' && values.device !== 'ipad')
      throw new Usage('start takes --device iphone or --device ipad.');
    return start(
      values.device,
      values.udid,
      values['agent-device-config'],
      values['agent-device-command'],
    );
  }
  if (name === 'doctor') return doctor();
  if (name === 'build') {
    refuseMissing(missingTools(['simulator']));
    mkdirSync(registry.home, { recursive: true });
    const log = join(registry.home, `build-${Date.now()}.log`);
    await buildDevelopmentClient(log);
    return `built matching development client; log ${log}\n`;
  }
  if (name === 'stop')
    return stopOutput(await registry.stopById(values.instance));
  if (name === 'status')
    return `${JSON.stringify(await registry.status(values.instance), null, 2)}\n`;
  if (name === 'evidence')
    return registry
      .evidence({
        evidence: registry.evidencePath(values.instance),
        secrets: [],
      })
      .listing();
  if (name === undefined) throw new Usage(usage);
  if (!['logs', 'pairing-link', 'agent', 'server'].includes(name))
    throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  if (name === 'pairing-link') {
    const grant = await issuedLink(
      instance.detail.manifest,
      'Verification simulator',
      false,
      registry.redactor(instance).recorder(),
    );
    return `${pairingLink({ addresses: [grant.address], code: grant.code, environmentId: grant.environmentId })}\n`;
  }
  return registry.drive(instance, args, async () => {
    if (name === 'logs')
      return `recorded ${await registry.evidence(instance).record('logs', args, logs(instance))}\n`;
    const recorder = registry.redactor(instance).recorder();
    const output =
      name === 'agent'
        ? await agentCommand(instance.detail.manifest, rest, values, recorder)
        : await serverRead(instance.detail.manifest, rest, recorder);
    return `${output}\nrecorded ${await registry.evidence(instance).record(name, args, output)}\n`;
  });
}
await runCli(command);

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDevelopmentClient } from '../../../../apps/mobile/spec/kit/development-client.ts';
import { deviceHost } from '../../../../apps/mobile/spec/kit/device-host.ts';
import {
  isBooted,
  shutdownSimulator,
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import {
  refuseMissing,
  runCli,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import {
  agentDevice,
  connectHub,
  disconnectHub,
  isHosted,
  remoteBooted,
  type Target,
} from './device.ts';
import {
  registry,
  scriptFingerprint,
  type MobileInstance,
} from './instance.ts';
import { serve, start, startProblems } from './serve.ts';

const logWindow = '10m';
const logTail = 400;
const usage = `Usage: .agents/skills/mobile-verify/scripts/cli <command> [--instance <id>]
  build                    prebuild and build the development client for the iOS simulator (native changes only)
  start [--device iphone|ipad]
                           start a disposable server, Metro and a simulator of its own, install and open the development client and pair it
  doctor                   check the tools, the development client build and the live instances
  stop                     stop owned processes and request simulator shutdown; the evidence stays
  evidence                 print the evidence folder and what it holds
  refresh                  request a Metro reload; inspect the changed behavior with Maestro
  logs                     record the app, Metro and server logs
`;

function targetOf(instance: MobileInstance): Target {
  return {
    udid: instance.detail.udid,
    session: instance.detail.session,
    cwd: instance.evidence,
    host: instance.detail.host,
  };
}

async function booted(instance: MobileInstance): Promise<boolean> {
  const target = targetOf(instance);
  return isHosted(target)
    ? remoteBooted(target)
    : isBooted(instance.detail.udid);
}

function refresh(instance: MobileInstance): string {
  const script = scriptFingerprint();
  const output = agentDevice(targetOf(instance), [
    'metro',
    'reload',
    '--metro-host',
    'localhost',
    '--metro-port',
    new URL(instance.detail.metro).port,
  ]);
  registry.update(instance, (current) => ({
    ...current,
    detail: { ...current.detail, script },
  }));
  return `${output}\nMetro accepted a reload request; inspect the changed behavior with Maestro.\n`;
}

async function doctor(): Promise<string> {
  const host = deviceHost().remote;
  const problems = (await startProblems(host)).filter(
    (problem) => problem !== undefined,
  );
  const lines = [
    `node ${process.versions.node}`,
    ...(problems.length > 0
      ? problems.map((problem) => `FAIL ${problem}`)
      : [
          host === undefined
            ? 'ok   Xcode simulators and the agent-device setup tool are installed, and the development client is built for this native code'
            : `ok   the device host ${host.hub} answers, its token is set and the ports are free`,
        ]),
  ];
  const live = registry
    .list()
    .filter((entry) => entry.alive)
    .map((entry) => entry.instance);
  for (const instance of live) {
    const metro = await fetch(`${instance.detail.metro}/status`)
      .then((response) => response.text())
      .catch(() => '');
    const health = await fetch(`${instance.detail.server}/api/health`)
      .then((response) => response.status)
      .catch(() => 0);
    const stale = await registry.staleness(instance);
    lines.push(
      `instance ${instance.id} (${instance.detail.kind}, ${instance.detail.simulator})`,
      `  ${(await booted(instance)) ? 'ok  ' : 'FAIL'} its simulator ${instance.detail.udid} is booted`,
      `  ${metro.includes('packager-status:running') ? 'ok  ' : 'FAIL'} Metro answers at ${instance.detail.metro}`,
      `  ${health === 200 ? 'ok  ' : 'FAIL'} the server health route answers 200`,
      `  ${stale === undefined ? 'ok   the server, native and CLI code match the checkout' : `FAIL ${stale}`}`,
      `  ${scriptFingerprint() === instance.detail.script ? 'ok   JavaScript matches the last start or accepted reload request; inspect the app to verify it' : 'FAIL JavaScript changed; run refresh and inspect the changed behavior with Maestro'}`,
    );
  }
  if (lines.some((line) => line.includes('FAIL'))) process.exitCode = 1;
  return `${lines.join('\n')}\nlive instances: ${live.length}\n`;
}

function appLog(instance: MobileInstance): string {
  if (instance.detail.host !== null)
    return `(the app's log stays on the device host ${instance.detail.host.hub}; Metro's below carries the JavaScript log)\n`;
  const app = spawnSync(
    'xcrun',
    [
      'simctl',
      'spawn',
      instance.detail.udid,
      'log',
      'show',
      '--last',
      logWindow,
      '--style',
      'compact',
      '--predicate',
      'process == "PorcelainDev" AND NOT subsystem BEGINSWITH "com.apple.dt.xctest" AND (subsystem BEGINSWITH "com.facebook.react" OR messageType == error OR messageType == fault)',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return `${app.stdout.split('\n').slice(-logTail).join('\n')}${app.stderr}`;
}

function logs(instance: MobileInstance): string {
  const tail = (name: string) => {
    const path = join(instance.evidence, name);
    return existsSync(path)
      ? readFileSync(path, 'utf8').split('\n').slice(-logTail).join('\n')
      : '(none)';
  };
  return [
    `## app (last ${logWindow})`,
    appLog(instance),
    '## metro',
    tail('metro.log'),
    '## server',
    tail('server.log'),
    '',
  ].join('\n');
}

async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      instance: { type: 'string' },
      device: { type: 'string', default: 'iphone' },
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
    if (values.device !== 'iphone' && values.device !== 'ipad')
      throw new Usage('start takes --device iphone or --device ipad.');
    return start(values.device);
  }
  if (name === 'build') {
    refuseMissing(missingTools(['simulator']));
    mkdirSync(registry.home, { recursive: true });
    const log = join(registry.home, `build-${Date.now()}.log`);
    const began = performance.now();
    await buildDevelopmentClient(log);
    return `built the development client in ${Math.round((performance.now() - began) / 1000)} s\nlog ${log}\n`;
  }
  if (name === 'doctor') return doctor();
  if (name === undefined) throw new Usage(usage);
  if (name === 'stop') {
    const instance =
      values.instance === undefined
        ? registry.chosen(undefined)
        : registry.list().find((entry) => entry.instance.id === values.instance)
            ?.instance;
    const result = await registry.stopById(values.instance);
    const report = [...result.report];
    if (result.complete && !result.alreadyStopped && instance !== undefined) {
      const target = targetOf(instance);
      if (isHosted(target)) {
        connectHub(target);
        try {
          if (remoteBooted(target)) {
            agentDevice(target, ['close', '--shutdown'], {
              allowFailure: true,
            });
            report.push(`requested simulator shutdown ${instance.detail.udid}`);
          }
        } finally {
          disconnectHub(target);
        }
      } else if (await isBooted(instance.detail.udid)) {
        await shutdownSimulator(instance.detail.udid);
        report.push(`requested simulator shutdown ${instance.detail.udid}`);
      }
    }
    return stopOutput({ ...result, report });
  }
  if (name === 'evidence')
    return registry
      .evidence({
        evidence: registry.evidencePath(values.instance),
        secrets: [],
      })
      .listing();
  if (name !== 'refresh' && name !== 'logs') throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  return registry.drive(instance, args, async () => {
    const evidence = registry.evidence(instance);
    const redactor = registry.redactor(instance);
    if (name === 'refresh') {
      try {
        const output = refresh(instance);
        return `${redactor.text(output)}\nrecorded ${await evidence.record('refresh', args, output)}\n`;
      } catch (error) {
        if (error instanceof Error)
          await evidence.record('refresh', args, error.message);
        throw error;
      }
    }
    return `recorded ${await evidence.record('logs', args, logs(instance))}\n`;
  });
}

await runCli(command);

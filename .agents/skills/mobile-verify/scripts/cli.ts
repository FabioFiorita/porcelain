import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildDevelopmentClient,
  identity,
  screenLink,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { issuePairingLink } from '../../../../apps/mobile/spec/kit/environment.ts';
import { deviceHost } from '../../../../apps/mobile/spec/kit/device-host.ts';
import {
  isBooted,
  shutdownSimulator,
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import { ServerHandle } from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  refuseMissing,
  runCli,
  Usage,
} from '../../server-verify/scripts/core/cli.ts';
import {
  agentDevice,
  connectHub,
  disconnectHub,
  fillField,
  isHosted,
  remoteBooted,
  selector,
  type Target,
} from './device.ts';
import {
  registry,
  scriptFingerprint,
  type MobileInstance,
} from './instance.ts';
import { pairingLabel, serve, start, startProblems } from './serve.ts';

const freshLink = '{pairing-link}';
const holdMs = 1500;
const logWindow = '10m';
const logTail = 400;
const usage = `Usage: .agents/skills/mobile-verify/scripts/cli <command> [--instance <id>]
  build                    prebuild and build the development client for the iOS simulator (native changes only)
  start [--device iphone|ipad]
                           start a disposable server, Metro and a simulator of its own, install and open the development client and pair it
  doctor                   check the tools, the development client build and the live instances
  stop                     shut down the instance's simulator, Metro and server; the evidence stays
  evidence                 print the evidence folder and what it holds
  open <screen|deep link>  open a screen such as /files, or a ${identity.scheme}:// deep link
  tap --id <testID> | --label <label> [--long]
                           --long holds the element, for a context menu
  fill <value> --id <testID> | --label <label>
                           the value ${freshLink} types a fresh pairing link from the instance's server, never recorded
  snapshot                 record the accessibility tree
  screenshot               record a screenshot
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

function linkOf(destination: string | undefined): string {
  if (destination === undefined)
    throw new Usage('open takes a screen such as /files or a deep link.');
  if (destination.startsWith('/')) return screenLink(destination);
  const scheme = `${identity.scheme}://`;
  if (destination.startsWith(scheme))
    return destination.includes('?')
      ? destination
      : screenLink(destination.slice(scheme.length));
  throw new Usage(
    `open takes a screen path starting with / or a ${identity.scheme}:// deep link.`,
  );
}

function reloaded(instance: MobileInstance): string {
  const script = scriptFingerprint();
  if (script === instance.detail.script) return '';
  agentDevice(
    targetOf(instance),
    [
      'metro',
      'reload',
      '--metro-host',
      'localhost',
      '--metro-port',
      new URL(instance.detail.metro).port,
    ],
    { allowFailure: true },
  );
  registry.update(instance, (current) => ({
    ...current,
    detail: { ...current.detail, script },
  }));
  return 'JavaScript changed since the last command; Metro reloaded the app from it.\n';
}

async function issueLink(instance: MobileInstance): Promise<MobileInstance> {
  const link = await issuePairingLink(
    await ServerHandle.attach(instance.detail.manifest),
    registry.redactor(instance).recorder(),
    pairingLabel,
  );
  return registry.update(instance, (current) => ({
    ...current,
    secrets: [...current.secrets, link],
  }));
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
            ? 'ok   Xcode simulators and agent-device are installed, and the development client is built for this native code'
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
    const stale = registry.staleness(instance);
    lines.push(
      `instance ${instance.id} (${instance.detail.kind}, ${instance.detail.simulator})`,
      `  ${(await booted(instance)) ? 'ok  ' : 'FAIL'} its simulator ${instance.detail.udid} is booted`,
      `  ${metro.includes('packager-status:running') ? 'ok  ' : 'FAIL'} Metro answers at ${instance.detail.metro}`,
      `  ${health === 200 ? 'ok  ' : 'FAIL'} the server health route answers 200`,
      `  ${stale === undefined ? 'ok   the server, native and CLI code match the checkout' : `FAIL ${stale}`}`,
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
      id: { type: 'string' },
      label: { type: 'string' },
      long: { type: 'boolean', default: false },
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
  const instance = registry.chosen(values.instance, {
    includeStopped: name === 'stop',
  });
  if (name === 'stop') {
    const report = await registry.stop(instance);
    const target = targetOf(instance);
    if (isHosted(target)) {
      connectHub(target);
      if (remoteBooted(target)) {
        agentDevice(target, ['close', '--shutdown'], { allowFailure: true });
        report.push(`shut down the simulator ${instance.detail.udid}`);
      }
      disconnectHub(target);
    }
    if (!isHosted(target) && (await isBooted(instance.detail.udid))) {
      await shutdownSimulator(instance.detail.udid);
      report.push(`shut down the simulator ${instance.detail.udid}`);
    }
    return `${report.map((line) => `${line}\n`).join('')}stopped ${instance.id}; simulator ${instance.detail.udid} shut down\nevidence ${instance.evidence}\n`;
  }
  if (name === 'evidence') return registry.evidence(instance).listing();
  return registry.drive(instance, args, async () => {
    const note = reloaded(instance);
    const target = targetOf(instance);
    const evidence = registry.evidence(instance);
    const redactor = registry.redactor(instance);
    if (name === 'open') {
      const output = agentDevice(target, [
        'open',
        identity.bundleIdentifier,
        linkOf(rest[0]),
      ]);
      const accepted = agentDevice(target, ['alert', 'accept', '3000'], {
        allowFailure: true,
      });
      const settled = accepted.trim().startsWith('accepted')
        ? `${output}\naccepted the system confirmation to open the link\n`
        : output;
      return `${note}${redactor.text(settled)}\nrecorded ${await evidence.record('open', args, settled)}\n`;
    }
    if (name === 'tap') {
      const output = agentDevice(
        target,
        values.long
          ? ['longpress', selector(values), String(holdMs), '--settle']
          : ['press', selector(values), '--settle'],
      );
      return `${note}${redactor.text(output)}\nrecorded ${await evidence.record('tap', args, output)}\n`;
    }
    if (name === 'fill') {
      const value = rest[0];
      if (value === undefined)
        throw new Usage('fill takes <value> and --id or --label.');
      const latest = value === freshLink ? await issueLink(instance) : instance;
      const typed = value === freshLink ? (latest.secrets.at(-1) ?? '') : value;
      const output = fillField(target, selector(values), typed);
      return `${note}${registry.redactor(latest).text(output)}\nrecorded ${await registry.evidence(latest).record('fill', args, output)}\n`;
    }
    if (name === 'snapshot') {
      const output = agentDevice(target, ['snapshot']);
      return `${note}${redactor.known(output)}\nrecorded ${await evidence.record('snapshot', args, output)}\n`;
    }
    if (name === 'screenshot') {
      const claimed = await evidence.claim('screenshot', 'txt');
      const file = evidence.sibling(claimed, 'png');
      agentDevice(target, ['screenshot', file]);
      await evidence.write(claimed, args, `screenshot in ${file}\n`);
      return `${note}recorded ${file}\n(${claimed})\n`;
    }
    if (name === 'logs')
      return `${note}recorded ${await evidence.record('logs', args, logs(instance))}\n`;
    throw new Usage(usage);
  });
}

await runCli(command);

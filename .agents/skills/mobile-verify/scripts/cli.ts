import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import {
  buildDevelopmentClient,
  buildProblem,
  identity,
  screenLink,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { issuePairingLink } from '../../../../apps/mobile/spec/kit/environment.ts';
import { isBooted } from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import {
  Recorder,
  ServerHandle,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import { agentDevice, fillField, selector, type Target } from './device.ts';
import {
  alive,
  chosen,
  fingerprints,
  home,
  liveInstances,
  nextFile,
  record,
  Refusal,
  saveInstance,
  scrubber,
  staleness,
  type Instance,
} from './instance.ts';
import { pairingLabel, serve, start } from './serve.ts';

const stopLimitMs = 60 * 1000;
const freshLink = '{pairing-link}';
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

function targetOf(instance: Instance): Target {
  return {
    udid: instance.udid,
    session: instance.session,
    cwd: instance.evidence,
  };
}

function linkOf(destination: string | undefined): string {
  if (destination === undefined)
    throw new Refusal('open takes a screen such as /files or a deep link.');
  if (destination.startsWith('/')) return screenLink(destination);
  if (destination.startsWith(`${identity.scheme}://`)) return destination;
  throw new Refusal(
    `open takes a screen path starting with / or a ${identity.scheme}:// deep link.`,
  );
}

function driven(instance: Instance): string {
  const stale = staleness(instance);
  if (stale !== undefined) {
    record(instance, 'refused', ['(stale build)'], `${stale}\n`);
    throw new Refusal(stale);
  }
  const script = fingerprints().script;
  if (script === instance.fingerprints.script) return '';
  agentDevice(
    targetOf(instance),
    [
      'metro',
      'reload',
      '--metro-host',
      'localhost',
      '--metro-port',
      new URL(instance.metro).port,
    ],
    { allowFailure: true },
  );
  saveInstance({
    ...instance,
    fingerprints: { ...instance.fingerprints, script },
  });
  return 'JavaScript changed since the last command; Metro reloaded the app from it.\n';
}

async function issueLink(instance: Instance): Promise<string> {
  const recorder = new Recorder();
  for (const secret of instance.secrets) recorder.secret(secret);
  const link = await issuePairingLink(
    await ServerHandle.attach(instance.manifest),
    recorder,
    pairingLabel,
  );
  saveInstance({ ...instance, secrets: [...instance.secrets, link] });
  return link;
}

function evidenceListing(instance: Instance): string {
  return `${instance.evidence}\n${readdirSync(instance.evidence)
    .toSorted()
    .map((file) => `  ${file}`)
    .join('\n')}\n`;
}

async function stopInstance(instance: Instance): Promise<string> {
  process.kill(instance.pid, 'SIGTERM');
  const deadline = Date.now() + stopLimitMs;
  while (alive(instance.pid) && Date.now() < deadline) await sleep(200);
  if (alive(instance.pid))
    throw new Refusal(
      `Instance ${instance.id} (pid ${instance.pid}) did not stop in a minute; the evidence stays in ${instance.evidence}.`,
    );
  return `stopped ${instance.id}; simulator ${instance.udid} shut down\nevidence ${instance.evidence}\n`;
}

async function doctor(): Promise<string> {
  const problems = missingTools(['simulator', 'agent-device']);
  const lines = [
    `node ${process.versions.node}`,
    ...(problems.length > 0
      ? problems.map((problem) => `FAIL ${problem}`)
      : ['ok   Xcode simulators and agent-device are installed']),
  ];
  if (problems.length === 0) {
    const unbuilt = buildProblem();
    lines.push(
      unbuilt === undefined
        ? 'ok   the development client is built for this native code'
        : `FAIL ${unbuilt}`,
    );
  }
  for (const instance of liveInstances()) {
    const metro = await fetch(`${instance.metro}/status`)
      .then((response) => response.text())
      .catch(() => '');
    const health = await fetch(`${instance.server}/api/health`)
      .then((response) => response.status)
      .catch(() => 0);
    const stale = staleness(instance);
    lines.push(
      `instance ${instance.id} (${instance.kind}, ${instance.simulator})`,
      `  ${(await isBooted(instance.udid)) ? 'ok  ' : 'FAIL'} its simulator ${instance.udid} is booted`,
      `  ${metro.includes('packager-status:running') ? 'ok  ' : 'FAIL'} Metro answers at ${instance.metro}`,
      `  ${health === 200 ? 'ok  ' : 'FAIL'} the server health route answers 200`,
      `  ${stale === undefined ? 'ok   the server and native code match the checkout' : `FAIL ${stale}`}`,
    );
  }
  if (lines.some((line) => line.includes('FAIL'))) process.exitCode = 1;
  return `${lines.join('\n')}\nlive instances: ${liveInstances().length}\n`;
}

function logs(instance: Instance): string {
  const app = spawnSync(
    'xcrun',
    [
      'simctl',
      'spawn',
      instance.udid,
      'log',
      'show',
      '--last',
      logWindow,
      '--style',
      'compact',
      '--predicate',
      'process == "PorcelainDev"',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const tail = (name: string) => {
    const path = join(instance.evidence, name);
    return existsSync(path)
      ? readFileSync(path, 'utf8').split('\n').slice(-logTail).join('\n')
      : '(none)';
  };
  return [
    `## app (last ${logWindow})`,
    `${app.stdout.split('\n').slice(-logTail).join('\n')}${app.stderr}`,
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
  if (name === 'serve') {
    const [id = '', kind = '', evidence = ''] = rest;
    if (kind !== 'iphone' && kind !== 'ipad') throw new Refusal(usage);
    await serve(id, kind, evidence);
    return '';
  }
  if (name === 'start') {
    if (values.device !== 'iphone' && values.device !== 'ipad')
      throw new Refusal('start takes --device iphone or --device ipad.');
    return start(values.device);
  }
  if (name === 'build') {
    const problems = missingTools(['simulator']);
    if (problems.length > 0) throw new Refusal(problems.join('\n'));
    mkdirSync(home, { recursive: true });
    const log = join(home, `build-${Date.now()}.log`);
    const began = performance.now();
    await buildDevelopmentClient(log);
    return `built the development client in ${Math.round((performance.now() - began) / 1000)} s\nlog ${log}\n`;
  }
  if (name === 'doctor') return doctor();
  const instance = chosen(values.instance);
  if (name === 'stop') return stopInstance(instance);
  if (name === 'evidence') return evidenceListing(instance);
  const note = driven(instance);
  const current = chosen(instance.id);
  const target = targetOf(current);
  if (name === 'open') {
    const output = agentDevice(target, [
      'open',
      identity.bundleIdentifier,
      linkOf(rest[0]),
    ]);
    const accepted = agentDevice(target, ['alert', 'accept', '3000'], {
      allowFailure: true,
    });
    const settled = `${output}\n${accepted}`;
    return `${note}${scrubber(current.secrets)(settled)}\nrecorded ${record(current, 'open', args, settled)}\n`;
  }
  if (name === 'tap') {
    const output = agentDevice(target, [
      values.long ? 'longpress' : 'press',
      selector(values),
      '--settle',
    ]);
    return `${note}${output}\nrecorded ${record(current, 'tap', args, output)}\n`;
  }
  if (name === 'fill') {
    const value = rest[0];
    if (value === undefined)
      throw new Refusal('fill takes <value> and --id or --label.');
    const typed = value === freshLink ? await issueLink(current) : value;
    const latest = chosen(current.id);
    const output = fillField(target, selector(values), typed);
    const scrub = scrubber(latest.secrets);
    return `${note}${scrub(output)}\nrecorded ${record(latest, 'fill', args, output)}\n`;
  }
  if (name === 'snapshot') {
    const output = agentDevice(target, ['snapshot']);
    return `${note}${output}\nrecorded ${record(current, 'snapshot', args, output)}\n`;
  }
  if (name === 'screenshot') {
    const file = nextFile(current, 'screenshot', 'png');
    agentDevice(target, ['screenshot', file]);
    const listed = record(
      current,
      'screenshot',
      args,
      `screenshot in ${file}\n`,
    );
    return `${note}recorded ${file}\n(${listed})\n`;
  }
  if (name === 'logs') {
    const output = scrubber(current.secrets)(logs(current));
    return `${note}recorded ${record(current, 'logs', args, output)}\n`;
  }
  throw new Refusal(usage);
}

try {
  process.stdout.write(await command(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = error instanceof Refusal ? 2 : 1;
}

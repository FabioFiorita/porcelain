import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  appPath,
  buildProblem,
  developmentLink,
  identity,
  repositoryRoot,
  screenLink,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { Environment } from '../../../../apps/mobile/spec/kit/environment.ts';
import {
  startMetro,
  type Metro,
} from '../../../../apps/mobile/spec/kit/metro.ts';
import {
  bootSimulator,
  resetApp,
  shutdownSimulator,
  type DeviceKind,
  type Simulator,
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import { agentDevice, fillField, type Target } from './device.ts';
import {
  alive,
  fingerprints,
  home,
  instanceFile,
  instanceSchema,
  Refusal,
  saveInstance,
  scrubber,
  type Instance,
} from './instance.ts';

const idleLimitMs = 30 * 60 * 1000;
const idlePollMs = 30 * 1000;
const startLimitMs = 25 * 60 * 1000;
const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
export const pairingLabel = 'Verification simulator';

function phase<T>(
  timings: Record<string, number>,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  return work().then((value) => {
    timings[name] = Math.round(performance.now() - started);
    return value;
  });
}

function connect(target: Target, metro: Metro): void {
  agentDevice(target, ['open', developmentLink(metro.url)]);
  agentDevice(target, ['alert', 'accept', '5000'], { allowFailure: true });
  agentDevice(target, ['wait', 'text', 'Review', '60000']);
}

function pair(target: Target, link: string): void {
  agentDevice(target, [
    'open',
    identity.bundleIdentifier,
    screenLink('/settings'),
  ]);
  agentDevice(target, ['alert', 'accept', '5000'], { allowFailure: true });
  agentDevice(target, ['press', 'label="Add environment"', '--settle']);
  fillField(target, 'id="pairing-link"', link);
  agentDevice(target, ['press', 'label="Pair"', '--settle']);
  agentDevice(target, ['wait', 'text', 'Online', '30000']);
}

export async function serve(
  id: string,
  kind: DeviceKind,
  evidence: string,
): Promise<void> {
  const log = (text: string) =>
    appendFileSync(join(evidence, 'supervisor.log'), `${text}\n`);
  const build = await mkdtemp(
    join(tmpdir(), 'porcelain-mobile-verify-server-'),
  );
  const session = `porcelain-mobile-${id}`;
  const timings: Record<string, number> = {};
  let environment: Environment | undefined;
  let metro: Metro | undefined;
  let simulator: Simulator | undefined;
  let stopping = false;
  const stop = async (reason: string) => {
    if (stopping) return;
    stopping = true;
    log(`stopping: ${reason}`);
    if (simulator !== undefined)
      agentDevice(
        { udid: simulator.udid, session, cwd: evidence },
        ['close', '--shutdown'],
        {
          allowFailure: true,
        },
      );
    metro?.stop();
    if (simulator !== undefined)
      await shutdownSimulator(simulator.udid).catch((error: unknown) =>
        log(`the simulator did not shut down: ${String(error)}`),
      );
    const failure = await environment?.stop();
    if (failure !== undefined) log(failure);
    await rm(build, { recursive: true, force: true });
    if (existsSync(instanceFile(id))) {
      const saved = instanceSchema.parse(
        JSON.parse(readFileSync(instanceFile(id), 'utf8')),
      );
      const scrub = scrubber(saved.secrets);
      for (const name of ['server.log', 'metro.log'])
        if (existsSync(join(evidence, name)))
          writeFileSync(
            join(evidence, name),
            scrub(readFileSync(join(evidence, name), 'utf8')),
          );
    }
    writeFileSync(
      join(evidence, 'stopped.txt'),
      `instance ${id} stopped: ${reason}\nthe simulator ${simulator?.udid ?? '(none)'} was shut down, Metro and the server stopped; this evidence stays\n`,
    );
    rmSync(instanceFile(id), { force: true });
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('stop'));
  process.on('SIGINT', () => void stop('interrupted'));
  try {
    const print = fingerprints();
    environment = await phase(timings, 'server', async () => {
      await buildIsolatedServer(build);
      return Environment.start({
        build,
        title: 'Verification',
        label: pairingLabel,
        workspace: false,
        onOutput: (text) => appendFileSync(join(evidence, 'server.log'), text),
      });
    });
    const started = environment;
    const scrub = scrubber([
      started.link,
      started.server.credential,
      started.server.desktopCredential,
    ]);
    metro = await phase(timings, 'metro', () =>
      startMetro(join(evidence, 'metro.log')),
    );
    const bundler = metro;
    simulator = await phase(timings, 'simulator', () =>
      bootSimulator(kind, 'verify'),
    );
    const device = simulator;
    const target = { udid: device.udid, session, cwd: evidence };
    await phase(timings, 'install', () =>
      resetApp(device.udid, appPath, identity.bundleIdentifier),
    );
    await phase(timings, 'connect', async () => connect(target, bundler));
    await phase(timings, 'pair', async () => pair(target, started.link));
    const devices = await started.devices();
    writeFileSync(
      join(evidence, '000-start.txt'),
      scrub(
        [
          `instance ${id}`,
          `device ${kind}: ${device.name}`,
          `simulator ${device.udid}`,
          `metro ${bundler.url}`,
          `server ${started.server.address}`,
          `environment ${started.name}`,
          `repository ${started.server.repository}`,
          `paired devices on the server: ${JSON.stringify(devices)}`,
          `timings (ms): ${JSON.stringify(timings)}`,
          'The app paired through a one-time link typed into Settings; the link and credentials are not recorded.',
          '',
        ].join('\n'),
      ),
      { mode: 0o600 },
    );
    saveInstance({
      id,
      pid: process.pid,
      kind,
      udid: device.udid,
      simulator: device.name,
      session,
      metro: bundler.url,
      server: started.server.address,
      manifest: started.server.manifestPath,
      repository: started.server.repository,
      evidence,
      secrets: [
        started.link,
        started.server.credential,
        started.server.desktopCredential,
      ],
      fingerprints: print,
      startedAt: new Date().toISOString(),
      lastCommandAt: Date.now(),
      commands: 0,
    });
  } catch (error) {
    writeFileSync(
      join(evidence, 'start-failed.txt'),
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    await stop('start failed');
    return;
  }
  for (;;) {
    await sleep(idlePollMs);
    const saved = existsSync(instanceFile(id))
      ? instanceSchema.safeParse(
          JSON.parse(readFileSync(instanceFile(id), 'utf8')),
        )
      : undefined;
    if (
      saved === undefined ||
      !saved.success ||
      Date.now() - saved.data.lastCommandAt > idleLimitMs
    ) {
      writeFileSync(
        join(evidence, 'idle-stop.txt'),
        `No command reached instance ${id} for 30 minutes; it stopped itself.\n`,
      );
      await stop('no command for 30 minutes');
    }
  }
}

export async function start(kind: DeviceKind): Promise<string> {
  const problems = missingTools(['simulator', 'agent-device']);
  const unbuilt = problems.length === 0 ? buildProblem() : undefined;
  if (problems.length > 0 || unbuilt !== undefined)
    throw new Refusal([...problems, ...(unbuilt ? [unbuilt] : [])].join('\n'));
  const id = randomBytes(3).toString('hex');
  const evidence = join(home, 'evidence', id);
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  const began = performance.now();
  const output = openSync(join(evidence, 'supervisor.log'), 'a');
  const supervisor = spawn(
    process.execPath,
    [cli, 'serve', id, kind, evidence],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: ['ignore', output, output],
    },
  );
  supervisor.unref();
  const deadline = Date.now() + startLimitMs;
  while (!existsSync(instanceFile(id))) {
    if (
      supervisor.pid === undefined ||
      !alive(supervisor.pid) ||
      Date.now() > deadline
    ) {
      const failed = join(evidence, 'start-failed.txt');
      throw new Refusal(
        `Instance ${id} did not start: ${existsSync(failed) ? readFileSync(failed, 'utf8').split('\n')[0] : 'read the supervisor log'}. Evidence: ${evidence}`,
      );
    }
    await sleep(500);
  }
  const instance: Instance = instanceSchema.parse(
    JSON.parse(readFileSync(instanceFile(id), 'utf8')),
  );
  return `instance ${id}\nsimulator ${instance.udid} (${instance.simulator})\nevidence ${evidence}\nstarted in ${Math.round(performance.now() - began)} ms\n`;
}

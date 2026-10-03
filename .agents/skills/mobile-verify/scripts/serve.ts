import { appendFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  buildProblem,
  developmentClient,
  developmentLink,
  identity,
  nativeFingerprint,
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
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import { refuseMissing } from '../../server-verify/scripts/core/cli.ts';
import type { Life } from '../../server-verify/scripts/core/registry.ts';
import {
  agentDevice,
  connectHub,
  disconnectHub,
  fillField,
  holdLease,
  remoteSimulator,
  resetRemoteApp,
  type Target,
} from './device.ts';
import {
  deviceHost,
  freeHostPorts,
  hostFileName,
  hostProblems,
  mainCheckoutHostFile,
  type DeviceHost,
} from './host.ts';
import { registry, scriptFingerprint } from './instance.ts';

const startLimitMs = 25 * 60 * 1000;
export const pairingLabel = 'Verification simulator';
const optionsSchema = z.object({
  kind: z.enum(['iphone', 'ipad']),
  host: z
    .object({
      hub: z.string(),
      tokenVariable: z.string(),
      ports: z.array(z.number()),
    })
    .nullable(),
});

type Timings = Record<string, number>;
type Booted = { target: Target & { udid: string }; name: string };

async function phase<T>(
  timings: Timings,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const value = await work();
  timings[name] = Math.round(performance.now() - started);
  return value;
}

function connect(target: Target, metro: Metro): void {
  agentDevice(target, [
    'open',
    identity.bundleIdentifier,
    developmentLink(metro.url),
  ]);
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
  agentDevice(target, ['press', 'id="add-environment"', '--settle']);
  fillField(target, 'id="pairing-link"', link);
  agentDevice(target, ['press', 'id="pair-environment"', '--settle']);
  agentDevice(target, ['wait', 'text', 'Online', '30000']);
}

async function localSimulator(
  life: Life,
  timings: Timings,
  kind: DeviceKind,
  base: Target,
): Promise<Booted> {
  const simulator = await phase(timings, 'simulator', () =>
    bootSimulator(kind, 'verify'),
  );
  const target = { ...base, udid: simulator.udid };
  life.onStop(async () => {
    agentDevice(target, ['close', '--shutdown'], { allowFailure: true });
    await shutdownSimulator(simulator.udid);
  });
  const client = developmentClient();
  if (client === undefined) throw new Error(buildProblem());
  await phase(timings, 'install', () =>
    resetApp(simulator.udid, client, identity.bundleIdentifier),
  );
  return { target, name: simulator.name };
}

async function hostedSimulator(
  life: Life,
  timings: Timings,
  kind: DeviceKind,
  base: Target & { host: NonNullable<Target['host']> },
): Promise<Booted> {
  connectHub(base);
  life.onStop(() => disconnectHub(base));
  const simulator = await phase(timings, 'simulator', async () =>
    remoteSimulator(base, kind),
  );
  const target = { ...base, udid: simulator.udid };
  life.onStop(() => {
    agentDevice(target, ['close', '--shutdown'], { allowFailure: true });
  });
  await phase(timings, 'install', async () => resetRemoteApp(target));
  life.onStop(holdLease(target));
  return { target, name: simulator.name };
}

export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const { kind, host } = optionsSchema.parse(life.options);
    const evidence = registry.evidenceFolder(life.id);
    const session = `porcelain-mobile-${life.id}`;
    const timings: Timings = {};
    const native = nativeFingerprint();
    const script = scriptFingerprint();
    const ports = host === null ? [] : await freeHostPorts(host, 2);
    if (host !== null && ports.length < 2)
      throw new Error(
        `fewer than two of the ports in ${hostFileName} are free on this machine`,
      );
    let udid = '(none)';
    life.onStop((reason) =>
      life
        .evidence()
        .note(
          'stopped.txt',
          `instance ${life.id} stopped: ${reason}\nthe simulator ${udid} was shut down, Metro and the server stopped; this evidence stays\n`,
        )
        .then(() => undefined),
    );
    const build = await mkdtemp(
      join(tmpdir(), 'porcelain-mobile-verify-server-'),
    );
    life.onStop(() => rm(build, { recursive: true, force: true }));
    const environment = await phase(timings, 'server', async () => {
      await buildIsolatedServer(build);
      return Environment.start({
        build,
        title: 'Verification',
        label: pairingLabel,
        workspace: false,
        onOutput: (text) => appendFileSync(join(evidence, 'server.log'), text),
        ...(ports[0] === undefined ? {} : { port: ports[0] }),
      });
    });
    life.onStop(async () => {
      const failure = await environment.stop();
      if (failure !== undefined) process.stdout.write(`${failure}\n`);
    });
    life.secret(
      environment.link,
      environment.server.credential,
      environment.server.desktopCredential,
    );
    const metro = await phase(timings, 'metro', () =>
      startMetro(join(evidence, 'metro.log'), ports[1]),
    );
    life.marker(`--localhost --port ${metro.port} --max-workers`);
    life.onStop(() => metro.stop());
    const hub =
      host === null
        ? null
        : { hub: host.hub, tokenVariable: host.tokenVariable };
    const base = { udid: undefined, session, cwd: evidence };
    const simulator =
      hub === null
        ? await localSimulator(life, timings, kind, { ...base, host: null })
        : await hostedSimulator(life, timings, kind, { ...base, host: hub });
    const { target } = simulator;
    udid = target.udid;
    await phase(timings, 'connect', async () => connect(target, metro));
    await phase(timings, 'pair', async () => pair(target, environment.link));
    const devices = await environment.devices();
    await life
      .evidence()
      .note(
        '000-start.txt',
        [
          `instance ${life.id}`,
          `device ${kind}: ${simulator.name}`,
          `simulator ${udid}`,
          ...(hub === null ? [] : [`device host ${hub.hub}`]),
          `metro ${metro.url}`,
          `server ${environment.server.address}`,
          `environment ${environment.name}`,
          `repository ${environment.server.repository}`,
          `paired devices on the server: ${JSON.stringify(devices)}`,
          `timings (ms): ${JSON.stringify(timings)}`,
          'The app paired through a one-time link typed into Settings; the link and credentials are not recorded.',
          '',
        ].join('\n'),
      );
    return {
      kind,
      udid,
      simulator: simulator.name,
      session,
      metro: metro.url,
      server: environment.server.address,
      manifest: environment.server.manifestPath,
      repository: environment.server.repository,
      native,
      script,
      host: hub,
    };
  });
}

export async function startProblems(
  host: DeviceHost | undefined,
): Promise<(string | undefined)[]> {
  if (host !== undefined) return hostProblems(host);
  const problems = missingTools(['simulator', 'agent-device']);
  if (process.platform !== 'darwin')
    problems.push(
      `To drive a Mac's simulator from here instead, describe the device host in ${mainCheckoutHostFile()}, as the skill's "A simulator on another machine" says.`,
    );
  return [...problems, problems.length === 0 ? buildProblem() : undefined];
}

export async function start(kind: DeviceKind): Promise<string> {
  const host = deviceHost();
  refuseMissing(await startProblems(host));
  const began = performance.now();
  const instance = await registry.launch(
    { kind, host: host ?? null },
    startLimitMs,
  );
  return `instance ${instance.id}\nsimulator ${instance.detail.udid} (${instance.detail.simulator})${instance.detail.host === null ? '' : ` on the device host ${instance.detail.host.hub}`}\nevidence ${instance.evidence}\nstarted in ${Math.round(performance.now() - began)} ms\n`;
}

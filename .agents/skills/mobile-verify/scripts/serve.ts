import { appendFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  appPath,
  buildProblem,
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
import { agentDevice, fillField, type Target } from './device.ts';
import { registry, scriptFingerprint } from './instance.ts';

const startLimitMs = 25 * 60 * 1000;
export const pairingLabel = 'Verification simulator';

async function phase<T>(
  timings: Record<string, number>,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const value = await work();
  timings[name] = Math.round(performance.now() - started);
  return value;
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

export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const { kind } = z
      .object({ kind: z.enum(['iphone', 'ipad']) })
      .parse(life.options);
    const evidence = registry.evidenceFolder(life.id);
    const session = `porcelain-mobile-${life.id}`;
    const timings: Record<string, number> = {};
    const native = nativeFingerprint();
    const script = scriptFingerprint();
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
      startMetro(join(evidence, 'metro.log')),
    );
    life.marker(`--localhost --port ${metro.port} --max-workers`);
    life.onStop(() => metro.stop());
    const simulator = await phase(timings, 'simulator', () =>
      bootSimulator(kind, 'verify'),
    );
    udid = simulator.udid;
    const target = { udid, session, cwd: evidence };
    life.onStop(async () => {
      agentDevice(target, ['close', '--shutdown'], { allowFailure: true });
      await shutdownSimulator(udid);
    });
    await phase(timings, 'install', () =>
      resetApp(udid, appPath, identity.bundleIdentifier),
    );
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
    };
  });
}

export async function start(kind: DeviceKind): Promise<string> {
  const problems = missingTools(['simulator', 'agent-device']);
  refuseMissing([
    ...problems,
    problems.length === 0 ? buildProblem() : undefined,
  ]);
  const began = performance.now();
  const instance = await registry.launch({ kind }, startLimitMs);
  return `instance ${instance.id}\nsimulator ${instance.detail.udid} (${instance.detail.simulator})\nevidence ${instance.evidence}\nstarted in ${Math.round(performance.now() - began)} ms\n`;
}

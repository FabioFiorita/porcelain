import { Schema } from 'effect';
import { appendFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import {
  buildProblem,
  nativeFingerprint,
  mobileRoot,
} from '@porcelain/mobile/kit/development-client';
import { Environment } from '@porcelain/mobile/kit/environment';
import {
  identity,
  developmentLink,
} from '@porcelain/mobile/kit/development-client';
import { startMetro } from '@porcelain/mobile/kit/metro';
import {
  deviceHost,
  mainCheckoutHostFile,
  type RemoteHost,
} from '@porcelain/mobile/kit/device-host';
import { adb } from '@porcelain/mobile/kit/android';
import {
  devicePlatform,
  type DeviceKind,
} from '@porcelain/mobile/kit/simulator';
import { missingTools } from '@porcelain/mobile/kit/tools';
import {
  memoryProblem,
  refuseMissing,
  sandboxProblems,
} from '../../verify-core/cli.ts';
import { connectionCard } from '../../verify-core/connection.ts';
import { freeHostPorts, hostProblems, hubUrl, hubToken } from './host.ts';
import { registry, optionsSchema, mobileConnectionSchema } from './instance.ts';
import { driver, pairClient, prepareHost, setupCommand } from './setup.ts';
const startLimitMs = 25 * 60 * 1000;
const pairingLabel = 'Verification simulator';
const manifestSchema = Schema.Struct({
  credentialFile: Schema.String,
  dataDirectory: Schema.String,
});

export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const options = Schema.decodeUnknownSync(optionsSchema)(life.options);
    const { kind, host, simulatorLimit } = options;
    const evidence = registry.evidenceFolder(life.id);
    const hub = options.agentCommand === undefined ? host : null;
    if (hub !== null) life.secret(hubToken(hub));
    const session = options.agentSession ?? `porcelain-mobile-${life.id}`;
    const setupSession = options.agentSession ?? `${session}-setup`;
    const platform = devicePlatform(kind);
    const native = await nativeFingerprint(mobileRoot, platform);
    const request = {
      action: 'prepare' as const,
      kind,
      owner: `porcelain-mobile-${life.id}`,
      fingerprint: native,
      limit: simulatorLimit,
      ...(options.udid === undefined ? {} : { udid: options.udid }),
    };
    const simulator = await prepareHost(host, request);
    if (simulator.pid !== undefined) life.own(simulator.pid);
    life.onStop(simulator.release);
    const agent = driver(
      folder,
      host,
      simulator.udid,
      session,
      options.agentConfig,
      options.agentCommand,
      platform,
    );
    if (hub !== null)
      setupCommand(agent, [
        'connect',
        'proxy',
        '--daemon-base-url',
        hubUrl(hub),
      ]);
    life.onStop(() => {
      setupCommand(agent, ['close'], undefined, true);
      if (hub !== null) setupCommand(agent, ['disconnect']);
    });
    const ports = host === null ? [] : await freeHostPorts(host, 2);
    const build = await mkdtemp(
      join(tmpdir(), 'porcelain-mobile-verify-server-'),
    );
    life.onStop(() => rm(build, { recursive: true, force: true }));
    await buildIsolatedServer(build);
    const environment = await Environment.start({
      build,
      platform,
      title: 'Verification',
      label: pairingLabel,
      workspace: false,
      ...(options.fixture === 'development'
        ? { fixture: 'development' as const }
        : {}),
      onOutput: (text) => appendFileSync(join(evidence, 'server.log'), text),
      ...(ports[0] === undefined ? {} : { port: ports[0] }),
    });
    life.onStop(async () => {
      await environment.stop();
    });
    life.secret(
      environment.link,
      environment.server.credential,
      environment.server.desktopCredential,
    );
    await life.evidence().note(
      'fixture.json',
      JSON.stringify(
        environment.recorder.redact({
          fixture: options.fixture,
          steps: environment.recorder.steps,
        }),
        null,
        2,
      ),
    );
    const metro = await startMetro(
      join(evidence, 'metro.log'),
      ports[1],
      {
        ownerSocket: environment.server.socketPath,
        serverAddress: environment.server.address,
      },
      platform,
    );
    life.own(metro.pid);
    life.onStop(() => metro.stop());
    if (platform === 'android') {
      life.onStop(async () => {
        await adb(
          simulator.udid,
          'shell',
          'am',
          'force-stop',
          identity.bundleIdentifier,
        );
      });
    }
    await life
      .evidence()
      .note(
        'setup.txt',
        `simulator ${simulator.udid}\ninstalled ${simulator.installed}\nsetup session ${setupSession}\n`,
      );
    if (options.manualPairing) {
      setupCommand(agent, ['open', identity.bundleIdentifier, '--foreground']);
      setupCommand(agent, [
        'open',
        identity.bundleIdentifier,
        developmentLink(metro.url),
        '--foreground',
      ]);
    } else {
      pairClient(agent, metro.url, environment.link, setupSession);
    }
    const devices = await environment.devices();
    if (
      options.manualPairing
        ? devices.length !== 0
        : devices.length !== 1 ||
          devices[0]?.label !== pairingLabel ||
          (platform === 'android' && devices[0]?.platform !== 'Android')
    )
      throw new Error(
        options.manualPairing
          ? 'The manual preview unexpectedly paired a native device.'
          : 'Pairing did not register exactly one native verification device.',
      );
    const health = await fetch(`${environment.server.address}/api/health`);
    if (
      health.status !== 200 ||
      !health.headers.get('content-type')?.includes('application/json')
    )
      throw new Error('The disposable health route did not answer JSON 200.');
    const { environmentId } = Schema.decodeUnknownSync(
      readHealthResponseSchema,
    )(await health.json());
    const ids = await environment.server.sampleIds();
    const manifest = Schema.decodeUnknownSync(manifestSchema)(
      JSON.parse(readFileSync(environment.server.manifestPath, 'utf8')),
    );
    await life
      .evidence()
      .note(
        'handoff.txt',
        `${options.manualPairing ? 'manual pairing; app left for developer' : 'setup session closed'}\npaired devices ${JSON.stringify(devices)}\n`,
      );
    return {
      ...options,
      udid: simulator.udid,
      simulator: simulator.name,
      borrowed: simulator.borrowed,
      installed: simulator.installed,
      session,
      metro: metro.url,
      server: environment.server.address,
      manifest: environment.server.manifestPath,
      repository: environment.server.repository,
      native,
      environmentId,
      environmentName: environment.name,
      ...ids,
      projectHome: environment.server.projectHome,
      ownerSocketPath: environment.server.socketPath,
      serverDataDirectory: manifest.dataDirectory,
      credentialFile: manifest.credentialFile,
      driver: agent,
    };
  });
}
export async function startProblems(
  host: RemoteHost | undefined,
  ownDriver = false,
  kind: DeviceKind = 'iphone',
  serial?: string,
): Promise<(string | undefined)[]> {
  if (kind === 'android') {
    const problems = [
      ...sandboxProblems(),
      memoryProblem(),
      ...missingTools(ownDriver ? ['android'] : ['android', 'agent-device']),
    ];
    if (serial === undefined || !/^emulator-\d+$/.test(serial))
      problems.push(
        'Select an already booted local Android emulator with --serial or androidSerial in .mobile-device-host.json; run adb devices -l to find it.',
      );
    else {
      const ready = await adb(
        serial,
        'shell',
        'getprop',
        'sys.boot_completed',
      ).catch(() => '');
      if (ready !== '1')
        problems.push(
          `Android emulator ${serial} is unavailable or still booting. Boot it in Android Studio or T3 and retry.`,
        );
    }
    return [
      ...problems,
      problems.filter(Boolean).length === 0
        ? await buildProblem('android')
        : undefined,
    ];
  }
  if (host !== undefined)
    return [...(await hostProblems(host, ownDriver)), memoryProblem()];
  const problems = [
    ...sandboxProblems(),
    memoryProblem(),
    ...missingTools(ownDriver ? ['simulator'] : ['simulator', 'agent-device']),
  ];
  if (process.platform !== 'darwin')
    problems.push(
      `Configure the Mac device host in ${mainCheckoutHostFile()}; see references/remote.md.`,
    );
  return [
    ...problems,
    problems.length === 0 ? await buildProblem() : undefined,
  ];
}
export async function start(
  kind: DeviceKind,
  udid?: string,
  agentConfig?: string,
  agentCommand?: string,
  manualPairing = false,
  fixture: 'development' | 'focused' = 'development',
  agentSession?: string,
): Promise<string> {
  const { remote, simulatorLimit, androidSerial } = deviceHost();
  const host = kind === 'android' ? undefined : remote;
  udid ??= kind === 'android' ? androidSerial : undefined;
  refuseMissing(
    await startProblems(host, agentCommand !== undefined, kind, udid),
  );
  const instance = await registry.launch(
    {
      ...(agentConfig === undefined ? {} : { agentConfig }),
      ...(agentCommand === undefined ? {} : { agentCommand }),
      ...(agentSession === undefined ? {} : { agentSession }),
      kind,
      manualPairing,
      fixture,
      host: host ?? null,
      simulatorLimit: Math.min(simulatorLimit ?? 2, 2),
      ...(udid === undefined ? {} : { udid }),
    },
    startLimitMs,
  );
  if (instance.connectionPath === undefined)
    throw new Error('The mobile launcher published no connection.');
  const card = Schema.decodeUnknownSync(mobileConnectionSchema)(
    JSON.parse(readFileSync(instance.connectionPath, 'utf8')),
  );
  const target =
    card.mobile.platform === 'android' ? card.mobile.serial : card.mobile.udid;
  return `${connectionCard(card, instance.connectionPath)}fixture ${fixture}\nsimulator ${target} (${card.mobile.simulator})\nmetro ${card.mobile.metroUrl}\nagent-device ${card.mobile.agentDevice.command}\n`;
}

import { Schema } from 'effect';
import { appendFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  buildProblem,
  nativeFingerprint,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import { Environment } from '../../../../apps/mobile/spec/kit/environment.ts';
import { startMetro } from '../../../../apps/mobile/spec/kit/metro.ts';
import {
  deviceHost,
  mainCheckoutHostFile,
  type RemoteHost,
} from '../../../../apps/mobile/spec/kit/device-host.ts';
import type { DeviceKind } from '../../../../apps/mobile/spec/kit/simulator.ts';
import { missingTools } from '../../../../apps/mobile/spec/kit/tools.ts';
import { refuseMissing, sandboxProblems } from '../../verify-core/cli.ts';
import { connectionCard } from '../../verify-core/connection.ts';
import { freeHostPorts, hostProblems, hubUrl, hubToken } from './host.ts';
import { registry, optionsSchema, mobileConnectionSchema } from './instance.ts';
import { driver, pairClient, prepareHost, setupCommand } from './setup.ts';
const startLimitMs = 25 * 60 * 1000;
export const pairingLabel = 'Verification simulator';
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
    const session = `porcelain-mobile-${life.id}`;
    const native = await nativeFingerprint();
    const request = {
      action: 'prepare' as const,
      kind,
      owner: session,
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
      title: 'Verification',
      label: pairingLabel,
      workspace: false,
      onOutput: (text) => appendFileSync(join(evidence, 'server.log'), text),
      ...(ports[0] === undefined ? {} : { port: ports[0] }),
    });
    life.onStop(async () => {
      const failure = await environment.stop();
      if (failure !== undefined) throw new Error(failure);
    });
    life.secret(
      environment.link,
      environment.server.credential,
      environment.server.desktopCredential,
    );
    const metro = await startMetro(join(evidence, 'metro.log'), ports[1]);
    life.own(metro.pid);
    life.onStop(() => metro.stop());
    await life
      .evidence()
      .note(
        'setup.txt',
        `simulator ${simulator.udid}\ninstalled ${simulator.installed}\nsetup session ${session}-setup\n`,
      );
    pairClient(agent, metro.url, environment.link, `${session}-setup`);
    const devices = await environment.devices();
    if (devices.length !== 1 || devices[0]?.label !== pairingLabel)
      throw new Error(
        'Pairing did not register exactly one native verification device.',
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
        `setup session closed\npaired devices ${JSON.stringify(devices)}\n`,
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
): Promise<(string | undefined)[]> {
  if (host !== undefined) return hostProblems(host, ownDriver);
  const problems = [
    ...sandboxProblems(),
    ...missingTools(['simulator', 'agent-device']),
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
): Promise<string> {
  const { remote, simulatorLimit } = deviceHost();
  refuseMissing(await startProblems(remote, agentCommand !== undefined));
  const instance = await registry.launch(
    {
      ...(agentConfig === undefined ? {} : { agentConfig }),
      ...(agentCommand === undefined ? {} : { agentCommand }),
      kind,
      host: remote ?? null,
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
  return `${connectionCard(card, instance.connectionPath)}simulator ${card.mobile.udid} (${card.mobile.simulator})\nmetro ${card.mobile.metroUrl}\nagent-device ${card.mobile.agentDevice.command}\n`;
}

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import { buildProblem, mobileRoot } from '../kit/development-client.ts';
import { startMetro } from '../kit/metro.ts';
import { deviceHost } from '../kit/device-host.ts';
import {
  bootSimulator,
  localBootProblem,
  shutdownSimulator,
  type DeviceKind,
} from '../kit/simulator.ts';
import { missingTools } from '../kit/tools.ts';

export type MobileDevice = {
  udid: string;
  kind: DeviceKind;
  metro: string;
  evidence: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    mobileDevice: MobileDevice;
    mobileServerBuild: string;
  }
}

export default async function setup(project: TestProject) {
  const problems = missingTools(['simulator', 'maestro']);
  const unbuilt = problems.length === 0 ? await buildProblem() : undefined;
  if (problems.length > 0 || unbuilt !== undefined)
    throw new Error(
      `The mobile e2e tests need macOS with a simulator, Maestro and the development client:\n${[...problems, ...(unbuilt === undefined ? [] : [unbuilt])].join('\n')}`,
    );
  const crowded = await localBootProblem(deviceHost().simulatorLimit);
  if (crowded !== undefined) throw new Error(crowded);
  const kind: DeviceKind = project.name.endsWith('-tablet') ? 'ipad' : 'iphone';
  const evidence = join(mobileRoot, 'test-results', 'e2e', kind);
  await rm(evidence, { recursive: true, force: true });
  await mkdir(evidence, { recursive: true });
  const build = await mkdtemp(join(tmpdir(), 'porcelain-mobile-e2e-server-'));
  const cleanups: (() => Promise<unknown>)[] = [
    () => rm(build, { recursive: true, force: true }),
  ];
  const teardown = async () => {
    for (const cleanup of cleanups.toReversed()) await cleanup();
  };
  try {
    await buildIsolatedServer(build);
    const metro = await startMetro(join(evidence, 'metro.log'));
    cleanups.push(async () => metro.stop());
    const simulator = await bootSimulator(kind, 'e2e');
    cleanups.push(() => shutdownSimulator(simulator.udid));
    project.provide('mobileServerBuild', build);
    project.provide('mobileDevice', {
      udid: simulator.udid,
      kind,
      metro: metro.url,
      evidence,
    });
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}

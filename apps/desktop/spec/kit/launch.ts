import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { electronExecutable } from './stage.ts';

const launchWithinMs = 30_000;

export type DesktopLaunch = {
  app: string;
  profile: string;
  projectHome: string;
  switches?: readonly string[];
};

export function launchOptions(launch: DesktopLaunch) {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
      environment[name] = value;
  return {
    executablePath: electronExecutable(),
    args: [
      launch.app,
      '--data-directory',
      launch.profile,
      '--project-home',
      launch.projectHome,
      ...(launch.switches ?? []),
    ],
    env: environment,
    timeout: launchWithinMs,
  };
}

export async function sampleRepository(folder: string): Promise<string> {
  const repository = join(folder, 'desktop-smoke');
  await mkdir(repository);
  const git = (args: string[]) =>
    execFileSync('git', ['-C', repository, ...args], {
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
      stdio: 'pipe',
    });
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Desktop proof']);
  git(['config', 'user.email', 'desktop@example.invalid']);
  await writeFile(join(repository, 'README.md'), '# Desktop smoke\n');
  git(['add', 'README.md']);
  git(['commit', '-m', 'Create smoke project']);
  return repository;
}

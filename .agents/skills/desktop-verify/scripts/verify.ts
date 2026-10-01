import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { desktopFeatures } from './feature-map.ts';

const name = process.argv[2] ?? 'installed-project';
const feature = desktopFeatures.find((entry) => entry.name === name);
if (feature === undefined) throw new Error(`Unknown desktop feature: ${name}`);
if (process.platform !== 'darwin')
  throw new Error('The installed desktop proof requires macOS');
const state = await realpath(await mkdtemp(join('/tmp', 'porcelain-desktop-')));
const evidence = resolve('dist/desktop/evidence', `${Date.now()}-${name}`);
const repository = join(state, 'desktop-smoke');
try {
  await mkdir(repository);
  await mkdir(evidence, { recursive: true });
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
  const result = await feature.run({
    executable: '/Applications/Porcelain.app/Contents/MacOS/Porcelain',
    profile: join(state, 'profile'),
    repository,
    evidence,
  });
  await writeFile(
    join(evidence, 'result.json'),
    `${JSON.stringify({ feature: name, promise: feature.promise, result }, null, 2)}\n`,
  );
  process.stdout.write(`PASS ${name}\nEvidence: ${evidence}\n`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Desktop verification failed';
  await writeFile(
    join(evidence, 'failure.txt'),
    `${error instanceof Error ? (error.stack ?? message) : message}\n`,
  );
  process.stderr.write(`${message}\nEvidence: ${evidence}\n`);
  process.exitCode = 1;
} finally {
  await rm(state, { recursive: true, force: true });
}

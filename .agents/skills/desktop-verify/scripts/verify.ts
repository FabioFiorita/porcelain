import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  electronExecutable,
  root,
  stageDesktop,
} from '../../../../scripts/desktop-stage.ts';
import { desktopFeatures } from './feature-map.ts';

const names = process.argv.slice(2);
const features =
  names.length === 0
    ? desktopFeatures.filter((entry) => entry.app === 'development')
    : names.map((name) => {
        const feature = desktopFeatures.find((entry) => entry.name === name);
        if (feature === undefined)
          throw new Error(`Unknown desktop feature: ${name}`);
        return feature;
      });
if (process.platform !== 'darwin')
  throw new Error('The desktop proof requires macOS');
const proofApp = join(root, 'dist/desktop/proof');
const development = {
  executable: electronExecutable(),
  appArguments: [proofApp],
};
const installed = {
  executable: '/Applications/Porcelain.app/Contents/MacOS/Porcelain',
  appArguments: [],
};
if (features.some((feature) => feature.app === 'development'))
  await stageDesktop({
    directory: proofApp,
    productName: 'Porcelain Proof',
    web: true,
  });

async function prove(feature: (typeof desktopFeatures)[number]) {
  const state = await realpath(
    await mkdtemp(join('/tmp', 'porcelain-desktop-')),
  );
  const evidence = resolve(
    root,
    'dist/desktop/evidence',
    `${Date.now()}-${feature.name}`,
  );
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
      ...(feature.app === 'installed' ? installed : development),
      profile: join(state, 'profile'),
      repository,
      evidence,
    });
    await writeFile(
      join(evidence, 'result.json'),
      `${JSON.stringify({ feature: feature.name, promise: feature.promise, result }, null, 2)}\n`,
    );
    process.stdout.write(`PASS ${feature.name}\nEvidence: ${evidence}\n`);
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Desktop verification failed';
    await writeFile(
      join(evidence, 'failure.txt'),
      `${error instanceof Error ? (error.stack ?? message) : message}\n`,
    );
    process.stderr.write(
      `FAIL ${feature.name}: ${message}\nEvidence: ${evidence}\n`,
    );
    return false;
  } finally {
    await rm(state, { recursive: true, force: true });
  }
}

for (const feature of features)
  if (!(await prove(feature))) {
    process.exitCode = 1;
    break;
  }

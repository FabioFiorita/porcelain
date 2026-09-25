import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIsolatedServer } from '../../../../scripts/dev-server.ts';
import { issuePairing, read } from '../../server-verify/scripts/fixture.ts';
import {
  IsolatedServer,
  Recorder,
} from '../../server-verify/scripts/session.ts';
import { loadFeatures } from './catalogue.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const features = await loadFeatures();
const argument = process.argv[2];
const usage =
  'Usage: node .agents/skills/web-verify/scripts/browser.ts --list|--all|<feature>\n';

if (argument === '--list') {
  for (const feature of features)
    process.stdout.write(
      `${feature.feature} ${feature.path}: ${feature.behavior}\n`,
    );
  process.exit(0);
}
const selected = features.filter(
  (feature) => argument === '--all' || argument === feature.feature,
);
if (selected.length === 0 || process.argv.length !== 3) {
  process.stderr.write(usage);
  process.exit(2);
}

const evidence = await mkdtemp(
  join(tmpdir(), 'porcelain-web-browser-evidence-'),
);
const config = resolve(
  repositoryRoot,
  '.agents/skills/web-verify/scripts/vitest.browser.config.ts',
);
let failed = false;
for (const feature of selected) {
  const build = await mkdtemp(join(tmpdir(), 'porcelain-web-server-'));
  const featureEvidence = join(evidence, feature.feature);
  await mkdir(featureEvidence);
  let server: IsolatedServer | undefined;
  try {
    await buildIsolatedServer(build);
    server = await IsolatedServer.start(repositoryRoot, build);
    const pairingEnv: Record<string, string> = {};
    if (feature.needsPairing) {
      const session = server.session(new Recorder(), {
        projectId: '',
        worktreeId: '',
      });
      const name = feature.feature.replaceAll(/[.-]/g, '_').toUpperCase();
      pairingEnv[`VITE_WEB_${name}_CODE`] = await issuePairing(
        session,
        `Web ${feature.feature}`,
      );
      const health = await read(session, {
        method: 'GET',
        path: '/api/health',
        auth: 'none',
      });
      if (typeof health.environmentId !== 'string')
        throw new Error('The isolated server reported no environment ID');
      pairingEnv.VITE_WEB_ENVIRONMENT_ID = health.environmentId;
    }
    const spec = resolve(repositoryRoot, feature.spec);
    const result = await new Promise<number>((done, fail) => {
      const child = spawn(
        'pnpm',
        ['exec', 'vitest', 'run', '--config', config, spec],
        {
          cwd: repositoryRoot,
          env: {
            ...process.env,
            PORCELAIN_API_TARGET: server?.address,
            PORCELAIN_WEB_EVIDENCE: featureEvidence,
            ...pairingEnv,
          },
          stdio: 'inherit',
        },
      );
      child.once('error', fail);
      child.once('close', (code) => done(code ?? 1));
    });
    if (result !== 0) failed = true;
  } finally {
    await server?.stop();
    await rm(build, { recursive: true, force: true });
  }
}
process.exitCode = failed ? 1 : 0;
process.stdout.write(`Browser evidence: ${evidence}\n`);

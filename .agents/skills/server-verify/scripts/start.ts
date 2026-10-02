import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  openSync,
  readFileSync,
  statSync,
} from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { IsolatedServer } from '../../../../apps/server/spec/kit/isolated-server.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  buildFingerprint,
  instanceOf,
  missingTools,
  recorderFor,
  Refusal,
  registry,
  repositoryRoot,
  writeEvidence,
  type Instance,
} from './instance.ts';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const IDLE_CHECK_MS = 30 * 1000;
const READY_LIMIT_MS = 60 * 1000;
const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const pendingSchema = z.object({
  id: z.string(),
  build: z.string(),
  evidence: z.string(),
  fingerprint: z.string(),
});

export async function start(): Promise<void> {
  const started = performance.now();
  const missing = missingTools();
  if (missing.length > 0) throw new Refusal(missing.join('\n'));
  const fingerprint = buildFingerprint();
  const id = randomBytes(4).toString('hex');
  const folder = join(registry, id);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const evidence = await mkdtemp(
    join(tmpdir(), `porcelain-server-evidence-${id}-`),
  );
  const build = join(folder, 'build');
  await buildIsolatedServer(build);
  await writeFile(
    join(folder, 'pending.json'),
    JSON.stringify({ id, build, evidence, fingerprint }),
  );
  const daemonLog = join(folder, 'daemon.log');
  const output = openSync(daemonLog, 'a');
  const daemon = spawn(process.execPath, [cli, 'serve', folder], {
    cwd: repositoryRoot,
    detached: true,
    stdio: ['ignore', output, output],
  });
  daemon.unref();
  const file = join(folder, 'instance.json');
  let exited = false;
  daemon.once('exit', () => {
    exited = true;
  });
  const deadline = performance.now() + READY_LIMIT_MS;
  while (!existsSync(file)) {
    if (exited || performance.now() > deadline) {
      const log = existsSync(daemonLog)
        ? await readFile(daemonLog, 'utf8')
        : '';
      await rm(folder, { recursive: true, force: true });
      throw new Refusal(
        `the server did not start${exited ? '' : ' within a minute'}:\n${log}`,
      );
    }
    await delay(25);
  }
  const instance = instanceOf(JSON.parse(await readFile(file, 'utf8')));
  const durationMs = Math.round(performance.now() - started);
  const recorder = recorderFor(instance);
  const written = await writeEvidence(instance, 'start', recorder, {
    command: ['start'],
    durationMs,
    instance: {
      id,
      address: instance.address,
      fingerprint,
      pid: instance.pid,
      repository: instance.repository,
    },
  });
  process.stdout.write(
    `instance ${id}\nurl ${instance.address}\nevidence ${evidence}\n`,
  );
  process.stderr.write(`started in ${durationMs} ms; evidence: ${written}\n`);
}

export async function serve(folder: string): Promise<void> {
  const pending = pendingSchema.parse(
    JSON.parse(await readFile(join(folder, 'pending.json'), 'utf8')),
  );
  const logFile = join(folder, 'server.log');
  const lastCommand = join(folder, 'last-command');
  const server = await IsolatedServer.start(
    repositoryRoot,
    pending.build,
    undefined,
    (text) => appendFileSync(logFile, text),
  );
  const ids = await server.sampleIds();
  const instance: Instance = {
    id: pending.id,
    folder,
    address: server.address,
    credential: server.credential,
    desktopCredential: server.desktopCredential,
    manifestPath: server.manifestPath,
    projectId: ids.projectId,
    worktreeId: ids.worktreeId,
    repository: server.repository,
    projectHome: server.projectHome,
    evidence: pending.evidence,
    fingerprint: pending.fingerprint,
    pid: process.pid,
    logFile,
    startedAt: new Date().toISOString(),
  };
  await writeFile(lastCommand, '');
  await writeFile(
    join(folder, 'instance.json.partial'),
    JSON.stringify(instance, null, 2),
    { mode: 0o600 },
  );
  await rm(join(folder, 'pending.json'));
  await rename(
    join(folder, 'instance.json.partial'),
    join(folder, 'instance.json'),
  );
  let stopping = false;
  const shutdown = async (reason: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(idle);
    appendFileSync(logFile, `\n[cli] stopping: ${reason}\n`);
    await writeEvidence(instance, 'server-stop', recorderFor(instance), {
      command: ['serve'],
      reason,
      serverOutput: readFileSync(logFile, 'utf8'),
    });
    await server.stop();
    await rm(folder, { recursive: true, force: true });
    process.exit(0);
  };
  const stopOn = (reason: string) => () => {
    shutdown(reason).catch((error: unknown) => {
      appendFileSync(logFile, `\n[cli] ${String(error)}\n`);
      process.exit(1);
    });
  };
  const idle = setInterval(() => {
    if (Date.now() - statSync(lastCommand).mtimeMs > IDLE_LIMIT_MS)
      stopOn('no command for 30 minutes')();
  }, IDLE_CHECK_MS);
  process.on('SIGTERM', stopOn('stop'));
  process.on('SIGINT', stopOn('interrupted'));
  server.exited.then(stopOn('the server exited'), stopOn('the server failed'));
}

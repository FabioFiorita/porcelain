import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Refusal } from './cli.ts';
import { Evidence, Redactor, type EvidenceFormat } from './evidence.ts';
import { buildFingerprint, type BuildInputs } from './fingerprint.ts';
import { endGroup, endLeader, endMatching, processes } from './processes.ts';

const core = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(core, '../../../../..');
const idleLimitMs = 30 * 60 * 1000;
const idlePollMs = 30 * 1000;
const heartbeatMs = 10 * 1000;
const startPollMs = 50;

const instanceSchema = z.object({
  id: z.string(),
  pid: z.number(),
  folder: z.string(),
  evidence: z.string(),
  fingerprint: z.string(),
  startedAt: z.string(),
  secrets: z.array(z.string()),
  markers: z.array(z.string()),
  detail: z.unknown(),
});
const pendingSchema = z.object({
  id: z.string(),
  evidence: z.string(),
  fingerprint: z.string(),
  options: z.unknown(),
});

export type Instance<Detail> = Omit<
  z.output<typeof instanceSchema>,
  'detail'
> & { detail: Detail };

export type Surface<Detail> = {
  name: 'server' | 'web' | 'desktop' | 'mobile';
  cli: string;
  detail: z.ZodType<Detail>;
  inputs: BuildInputs;
  format: EvidenceFormat;
  stale: (
    instance: Instance<Detail>,
    buildChanged: boolean,
  ) => string | undefined;
  stopWithinMs: number;
};

export type Life = {
  id: string;
  folder: string;
  options: unknown;
  evidence: () => Evidence;
  secret: (...values: readonly string[]) => void;
  marker: (value: string) => void;
  onStop: (cleanup: (reason: string) => Promise<void> | void) => void;
  stop: (reason: string) => void;
  stopping: () => boolean;
};

function touch(file: string): void {
  try {
    writeFileSync(file, '');
  } catch {
    return;
  }
}

export class Registry<Detail> {
  readonly home: string;
  private readonly surface: Surface<Detail>;
  private readonly cli: string;

  constructor(surface: Surface<Detail>) {
    this.surface = surface;
    this.cli = fileURLToPath(surface.cli);
    this.home = join(
      tmpdir(),
      'porcelain-verify',
      createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 16),
      surface.name,
    );
  }

  fingerprint(): string {
    return buildFingerprint(repositoryRoot, this.surface.inputs, [
      dirname(this.cli),
      core,
    ]);
  }

  evidenceFolder(id: string): string {
    return join(this.home, 'evidence', id);
  }

  private folderOf(id: string): string {
    return join(this.home, 'instances', id);
  }

  private marker(folder: string): string {
    return `${this.cli} serve ${folder}`;
  }

  redactor(instance: Pick<Instance<Detail>, 'secrets'>): Redactor {
    return new Redactor(instance.secrets);
  }

  evidence(instance: Pick<Instance<Detail>, 'secrets' | 'evidence'>) {
    return new Evidence(
      instance.evidence,
      this.redactor(instance),
      this.surface.format,
    );
  }

  private read(file: string): Instance<Detail> {
    const base = instanceSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    return { ...base, detail: this.surface.detail.parse(base.detail) };
  }

  save(instance: Instance<Detail>): void {
    const file = join(instance.folder, 'instance.json');
    const partial = `${file}.${process.pid}.partial`;
    writeFileSync(partial, `${JSON.stringify(instance, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(partial, file);
  }

  update(
    instance: Instance<Detail>,
    change: (current: Instance<Detail>) => Instance<Detail>,
  ): Instance<Detail> {
    const next = change(this.read(join(instance.folder, 'instance.json')));
    this.save(next);
    return next;
  }

  list(): { instance: Instance<Detail>; alive: boolean }[] {
    const root = join(this.home, 'instances');
    if (!existsSync(root)) return [];
    const running = processes();
    return readdirSync(root)
      .toSorted()
      .flatMap((id) => {
        const file = join(root, id, 'instance.json');
        if (!existsSync(file)) return [];
        const instance = this.read(file);
        const marker = this.marker(instance.folder);
        const alive = running.some(
          (entry) =>
            entry.pid === instance.pid && entry.command.includes(marker),
        );
        return [{ instance, alive }];
      });
  }

  alive(instance: Instance<Detail>): boolean {
    return this.list().some(
      (entry) => entry.instance.id === instance.id && entry.alive,
    );
  }

  chosen(
    requested: string | undefined,
    { includeStopped = false } = {},
  ): Instance<Detail> {
    const known = this.list();
    const candidates = known.filter(
      (entry) => entry.alive || (includeStopped && requested !== undefined),
    );
    const listing = known
      .map(
        ({ instance, alive }) =>
          `  ${instance.id}  ${alive ? 'running' : 'stopped'}  started ${instance.startedAt}`,
      )
      .join('\n');
    if (requested !== undefined) {
      const match = candidates.find((entry) => entry.instance.id === requested);
      if (match) return this.touched(match.instance);
      throw new Refusal(
        `no running instance ${requested} in this checkout${listing ? `:\n${listing}` : '; run start'}`,
      );
    }
    const [only, ...others] = candidates;
    if (!only)
      throw new Refusal('no running instance in this checkout; run start');
    if (others.length > 0)
      throw new Refusal(
        `${candidates.length} instances are running in this checkout; name one with --instance <id>:\n${listing}`,
      );
    return this.touched(only.instance);
  }

  private touched(instance: Instance<Detail>): Instance<Detail> {
    touch(join(instance.folder, 'last-command'));
    return instance;
  }

  async launch(
    options: unknown,
    readyWithinMs: number,
  ): Promise<Instance<Detail>> {
    const id = randomBytes(4).toString('hex');
    const folder = this.folderOf(id);
    const evidence = this.evidenceFolder(id);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await mkdir(evidence, { recursive: true, mode: 0o700 });
    await writeFile(
      join(folder, 'pending.json'),
      JSON.stringify({
        id,
        evidence,
        fingerprint: this.fingerprint(),
        options,
      }),
      { mode: 0o600 },
    );
    const log = openSync(join(evidence, 'supervisor.log'), 'a', 0o600);
    const supervisor = spawn(process.execPath, [this.cli, 'serve', folder], {
      cwd: repositoryRoot,
      detached: true,
      stdio: ['ignore', log, log],
    });
    supervisor.unref();
    let exited = false;
    supervisor.once('exit', () => {
      exited = true;
    });
    const file = join(folder, 'instance.json');
    const deadline = Date.now() + readyWithinMs;
    while (!existsSync(file)) {
      if (exited || Date.now() > deadline) {
        if (!exited && supervisor.pid !== undefined)
          await endLeader(
            supervisor.pid,
            this.marker(folder),
            this.surface.stopWithinMs,
          );
        await rm(folder, { recursive: true, force: true });
        const failed = join(evidence, 'start-failed.txt');
        throw new Refusal(
          `instance ${id} did not start${exited ? '' : ` within ${readyWithinMs / 1000} s`}: ${existsSync(failed) ? readFileSync(failed, 'utf8').split('\n')[0] : 'read supervisor.log'}; evidence: ${evidence}`,
        );
      }
      await sleep(startPollMs);
    }
    return this.read(file);
  }

  staleness(instance: Instance<Detail>): string | undefined {
    return this.surface.stale(
      instance,
      this.fingerprint() !== instance.fingerprint,
    );
  }

  async refuse(
    instance: Instance<Detail>,
    command: readonly string[],
    message: string,
  ): Promise<never> {
    await this.evidence(instance).record('refused', command, message);
    throw new Refusal(message);
  }

  async drive<T>(
    instance: Instance<Detail>,
    command: readonly string[],
    work: () => Promise<T>,
  ): Promise<T> {
    const beat = () => touch(join(instance.folder, 'last-command'));
    beat();
    const stale = this.staleness(instance);
    if (stale !== undefined) await this.refuse(instance, command, stale);
    const heartbeat = setInterval(beat, heartbeatMs);
    try {
      return await work();
    } catch (error) {
      if (error instanceof Error)
        error.message = this.redactor(instance).text(error.message);
      throw error;
    } finally {
      clearInterval(heartbeat);
      beat();
    }
  }

  async stop(instance: Instance<Detail>): Promise<string[]> {
    const report = await endLeader(
      instance.pid,
      this.marker(instance.folder),
      this.surface.stopWithinMs,
    );
    for (const marker of instance.markers)
      report.push(...(await endMatching(marker)));
    await rm(instance.folder, { recursive: true, force: true });
    return report;
  }

  async serve(
    folder: string,
    start: (life: Life) => Promise<Detail>,
  ): Promise<void> {
    const pending = pendingSchema.parse(
      JSON.parse(await readFile(join(folder, 'pending.json'), 'utf8')),
    );
    const secrets: string[] = [];
    const markers: string[] = [];
    const cleanups: ((reason: string) => Promise<void> | void)[] = [];
    const lastCommand = join(folder, 'last-command');
    const evidence = () =>
      new Evidence(
        pending.evidence,
        new Redactor(secrets),
        this.surface.format,
      );
    let idle: NodeJS.Timeout | undefined;
    let stopping = false;
    const shutdown = async (reason: string) => {
      if (stopping) return;
      stopping = true;
      clearInterval(idle);
      process.stdout.write(`[supervisor] stopping: ${reason}\n`);
      for (const cleanup of cleanups.toReversed())
        await Promise.resolve(cleanup(reason)).catch((error: unknown) =>
          process.stdout.write(
            `[supervisor] cleanup failed: ${String(error)}\n`,
          ),
        );
      for (const line of await endGroup(process.pid))
        process.stdout.write(`[supervisor] ${line}\n`);
      await evidence().scrub();
      await rm(folder, { recursive: true, force: true });
      process.exit(0);
    };
    const stop = (reason: string) => {
      shutdown(reason).catch((error: unknown) => {
        process.stdout.write(`[supervisor] ${String(error)}\n`);
        process.exit(1);
      });
    };
    process.on('SIGTERM', () => stop('stop'));
    process.on('SIGINT', () => stop('interrupted'));
    const life: Life = {
      id: pending.id,
      folder,
      options: pending.options,
      evidence,
      secret: (...values) => secrets.push(...values.filter(Boolean)),
      marker: (value) => markers.push(value),
      onStop: (cleanup) => cleanups.push(cleanup),
      stop,
      stopping: () => stopping,
    };
    try {
      const detail = await start(life);
      touch(lastCommand);
      this.save({
        id: pending.id,
        pid: process.pid,
        folder,
        evidence: pending.evidence,
        fingerprint: pending.fingerprint,
        startedAt: new Date().toISOString(),
        secrets,
        markers,
        detail,
      });
      await rm(join(folder, 'pending.json'));
    } catch (error) {
      await evidence().note(
        'start-failed.txt',
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      stop('start failed');
      return;
    }
    idle = setInterval(() => {
      if (!existsSync(lastCommand)) {
        stop('its instance folder was removed');
        return;
      }
      if (Date.now() - statSync(lastCommand).mtimeMs <= idleLimitMs) return;
      evidence()
        .note(
          'idle-stop.txt',
          `No command reached instance ${pending.id} for 30 minutes; it stopped itself.\n`,
        )
        .then(
          () => stop('no command for 30 minutes'),
          () => stop('no command for 30 minutes'),
        );
    }, idlePollMs);
  }
}

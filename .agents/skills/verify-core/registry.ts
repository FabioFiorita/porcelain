import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Refusal } from './cli.ts';
import { Evidence, Redactor, type EvidenceFormat } from './evidence.ts';
import { buildFingerprint, type BuildInputs } from './fingerprint.ts';
import {
  captureGroup,
  captureProcess,
  endGroup,
  endLeader,
  endProcess,
  processes,
  stopResultSchema,
  type ProcessIdentity,
  type StopResult,
} from './processes.ts';
const core = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(core, '../../..');
const startPollMs = 50;
const instanceSchema = Schema.Struct({
  id: Schema.String,
  pid: Schema.Finite,
  folder: Schema.String,
  evidence: Schema.String,
  fingerprint: Schema.String,
  startedAt: Schema.String,
  secrets: Schema.Array(Schema.String),
  detail: Schema.Unknown,
});
const processSchema = Schema.Struct({
  pid: Schema.Finite,
  pgid: Schema.Finite,
  command: Schema.String,
  birth: Schema.String,
});
const pendingSchema = Schema.Struct({
  id: Schema.String,
  evidence: Schema.String,
  fingerprint: Schema.String,
  options: Schema.Unknown,
});
export type Instance<Detail> = Omit<typeof instanceSchema.Type, 'detail'> & {
  detail: Detail;
};
export type Surface<Detail> = {
  name: 'server' | 'web' | 'desktop' | 'mobile';
  cli: string;
  detail: Schema.Codec<Detail>;
  inputs: BuildInputs;
  format: EvidenceFormat;
  stale: (
    instance: Instance<Detail>,
    buildChanged: boolean,
  ) => string | undefined | Promise<string | undefined>;
  stopWithinMs: number;
};
export type Life = {
  id: string;
  folder: string;
  options: unknown;
  evidence: () => Evidence;
  secret: (...values: readonly string[]) => void;
  own: (pid: number) => void;
  onStop: (cleanup: (reason: string) => Promise<void> | void) => void;
  stop: (reason: string) => void;
  stopping: () => boolean;
};
export type SessionStopResult = StopResult & {
  id: string;
  evidence: string;
  alreadyStopped: boolean;
};
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
  private validateId(id: string): void {
    if (!/^[a-f0-9]{8}$/.test(id))
      throw new Refusal(
        'instance IDs must be eight lowercase hexadecimal characters',
      );
  }
  evidencePath(requested?: string): string {
    if (requested !== undefined) this.validateId(requested);
    const folder =
      requested === undefined
        ? this.chosen(undefined).evidence
        : this.evidenceFolder(requested);
    if (!existsSync(folder))
      throw new Refusal(
        'no retained evidence for this instance in this checkout',
      );
    return folder;
  }
  private folderOf(id: string): string {
    this.validateId(id);
    return join(this.home, 'instances', id);
  }
  private marker(folder: string): string {
    return `${this.cli} serve ${folder}`;
  }
  private owned(folder: string): readonly ProcessIdentity[] {
    const file = join(folder, 'processes.json');
    return existsSync(file)
      ? Schema.decodeUnknownSync(Schema.Array(processSchema))(
          JSON.parse(readFileSync(file, 'utf8')),
        )
      : [];
  }
  private async finish(
    pid: number,
    folder: string,
    owned: readonly ProcessIdentity[],
  ): Promise<StopResult> {
    const results = [
      await endLeader(
        pid,
        this.marker(folder),
        this.surface.stopWithinMs,
        owned.find((entry) => entry.pid === pid),
        owned.filter((entry) => entry.pgid === pid),
      ),
    ];
    const supervisorGroup = owned[0]?.pgid ?? pid;
    for (const entry of owned)
      if (entry.pgid !== supervisorGroup)
        results.push(
          await endProcess(
            entry,
            this.surface.stopWithinMs,
            owned.filter((member) => member.pgid === entry.pgid),
          ),
        );
    return {
      complete: results.every((result) => result.complete),
      report: results.flatMap((result) => result.report),
    };
  }
  private stopOutcome(evidence: string): StopResult | undefined {
    const file = join(evidence, 'stop-result.json');
    if (!existsSync(file)) return undefined;
    try {
      return Schema.decodeUnknownSync(stopResultSchema)(
        JSON.parse(readFileSync(file, 'utf8')),
      );
    } catch {
      return {
        complete: false,
        report: ['retained stop outcome could not be read'],
      };
    }
  }
  private async retainStop(
    evidence: Evidence,
    redactor: Redactor,
    result: StopResult,
  ): Promise<StopResult> {
    const prior = this.stopOutcome(evidence.folder);
    const report =
      prior?.complete === false
        ? [
            ...prior.report,
            ...result.report,
            'prior shutdown remained incomplete; its unresolved outcome is retained',
          ]
        : result.report;
    const outcome = {
      complete: result.complete && prior?.complete !== false,
      report: [...new Set(report.map((line) => redactor.text(line)))],
    };
    await evidence.scrub();
    const partial = await evidence.note(
      `stop-result.json.${process.pid}.partial`,
      `${JSON.stringify(outcome, null, 2)}\n`,
    );
    renameSync(partial, join(evidence.folder, 'stop-result.json'));
    return outcome;
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
    const base = Schema.decodeUnknownSync(instanceSchema)(
      JSON.parse(readFileSync(file, 'utf8')),
    );
    return {
      ...base,
      detail: Schema.decodeUnknownSync(this.surface.detail)(base.detail),
    };
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
      this.validateId(requested);
      const match = candidates.find((entry) => entry.instance.id === requested);
      if (match) return match.instance;
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
    return only.instance;
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
    const captured =
      supervisor.pid === undefined ? undefined : captureProcess(supervisor.pid);
    let exited = false;
    supervisor.once('exit', () => {
      exited = true;
    });
    const file = join(folder, 'instance.json');
    const deadline = Date.now() + readyWithinMs;
    while (!existsSync(file)) {
      if (exited || Date.now() > deadline) {
        const prior = this.stopOutcome(evidence);
        if (prior?.complete !== true) {
          let owned = this.owned(folder);
          if (owned.length === 0 && captured !== undefined) {
            owned = [captured, ...captureGroup(captured)];
            await mkdir(folder, { recursive: true, mode: 0o700 });
            await writeFile(
              join(folder, 'processes.json'),
              JSON.stringify(owned),
              { mode: 0o600 },
            );
          }
          const result =
            supervisor.pid === undefined
              ? {
                  complete: false,
                  report: ['started supervisor has no captured PID'],
                }
              : await this.finish(supervisor.pid, folder, owned);
          const outcome = await this.retainStop(
            new Evidence(evidence, new Redactor([]), this.surface.format),
            new Redactor([]),
            result,
          );
          if (outcome.complete)
            await rm(folder, { recursive: true, force: true });
        }
        const failed = join(evidence, 'start-failed.txt');
        throw new Refusal(
          `instance ${id} did not start${exited ? '' : ` within ${readyWithinMs / 1000} s`}: ${existsSync(failed) ? readFileSync(failed, 'utf8').split('\n')[0] : 'read supervisor.log'}; evidence: ${evidence}`,
        );
      }
      await sleep(startPollMs);
    }
    return this.read(file);
  }
  async staleness(instance: Instance<Detail>): Promise<string | undefined> {
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
    const stale = await this.staleness(instance);
    if (stale !== undefined) await this.refuse(instance, command, stale);
    try {
      return await work();
    } catch (error) {
      if (error instanceof Error)
        error.message = this.redactor(instance).text(error.message);
      throw error;
    }
  }
  async stop(instance: Instance<Detail>): Promise<StopResult> {
    return this.stopRuntime(instance);
  }
  private async stopRuntime(
    instance: Pick<Instance<Detail>, 'pid' | 'folder' | 'evidence' | 'secrets'>,
  ): Promise<StopResult> {
    const snapshots: { name: string; content: string }[] = [];
    const restore = async () => {
      try {
        await mkdir(instance.folder, { recursive: true, mode: 0o700 });
        for (const snapshot of snapshots) {
          const file = join(instance.folder, snapshot.name);
          const partial = `${file}.${process.pid}.partial`;
          writeFileSync(partial, snapshot.content, { mode: 0o600 });
          renameSync(partial, file);
        }
        return true;
      } catch {
        return false;
      }
    };
    let result: StopResult;
    try {
      for (const name of ['instance.json', 'processes.json', 'pending.json']) {
        const file = join(instance.folder, name);
        if (existsSync(file))
          snapshots.push({ name, content: readFileSync(file, 'utf8') });
      }
      result = await this.finish(
        instance.pid,
        instance.folder,
        this.owned(instance.folder),
      );
    } catch {
      result = {
        complete: false,
        report: ['owned process cleanup could not be confirmed'],
      };
    }
    try {
      let outcome = await this.retainStop(
        this.evidence(instance),
        this.redactor(instance),
        result,
      );
      if (outcome.complete)
        try {
          await rm(instance.folder, { recursive: true, force: true });
        } catch {
          outcome = await this.retainStop(
            this.evidence(instance),
            this.redactor(instance),
            {
              complete: false,
              report: [
                ...outcome.report,
                'runtime cleanup failed; protected runtime retained',
              ],
            },
          );
        }
      if (!outcome.complete && !(await restore()))
        return {
          complete: false,
          report: [
            ...outcome.report,
            'protected runtime metadata could not be fully restored',
          ],
        };
      return outcome;
    } catch {
      const restored = await restore();
      return {
        complete: false,
        report: [
          ...result.report,
          'stop outcome could not be retained',
          restored
            ? 'protected runtime kept for recovery'
            : 'protected runtime metadata could not be fully restored',
        ].map((line) => this.redactor(instance).text(line)),
      };
    }
  }
  async stopById(requested?: string): Promise<SessionStopResult> {
    if (requested === undefined) {
      const instance = this.chosen(undefined);
      return {
        ...(await this.stop(instance)),
        id: instance.id,
        evidence: instance.evidence,
        alreadyStopped: false,
      };
    }
    this.validateId(requested);
    const evidence = this.evidenceFolder(requested);
    const folder = this.folderOf(requested);
    const prior = this.stopOutcome(evidence);
    if (prior?.complete === true && !existsSync(folder))
      return { ...prior, id: requested, evidence, alreadyStopped: true };
    const file = join(folder, 'instance.json');
    if (existsSync(file)) {
      const instance = this.read(file);
      return {
        ...(await this.stop(instance)),
        id: requested,
        evidence,
        alreadyStopped: false,
      };
    }
    if (existsSync(folder)) {
      const owned = this.owned(folder);
      const pid = owned[0]?.pid;
      if (pid === undefined)
        throw new Refusal(
          `instance ${requested} has no captured supervisor; runtime kept for recovery`,
        );
      return {
        ...(await this.stopRuntime({ pid, folder, evidence, secrets: [] })),
        id: requested,
        evidence,
        alreadyStopped: false,
      };
    }
    const outcome = this.stopOutcome(this.evidencePath(requested));
    if (outcome === undefined)
      throw new Refusal(
        `instance ${requested} has no confirmed stop outcome in this checkout`,
      );
    return {
      ...outcome,
      id: requested,
      evidence,
      alreadyStopped: outcome.complete,
    };
  }
  async serve(
    folder: string,
    start: (life: Life) => Promise<Detail>,
  ): Promise<void> {
    const pending = Schema.decodeUnknownSync(pendingSchema)(
      JSON.parse(await readFile(join(folder, 'pending.json'), 'utf8')),
    );
    const secrets: string[] = [];
    const owned: ProcessIdentity[] = [];
    const own = (pid: number) => {
      const identity = captureProcess(pid);
      if (identity === undefined)
        throw new Refusal(`could not capture the started process ${pid}`);
      for (const entry of [identity, ...captureGroup(identity)]) {
        const index = owned.findIndex(
          (current) =>
            current.pid === entry.pid && current.birth === entry.birth,
        );
        if (index === -1) owned.push(entry);
        else owned[index] = entry;
      }
      const file = join(folder, 'processes.json');
      const partial = `${file}.${process.pid}.partial`;
      writeFileSync(partial, `${JSON.stringify(owned)}\n`, { mode: 0o600 });
      renameSync(partial, file);
    };
    own(process.pid);
    const cleanups: ((reason: string) => Promise<void> | void)[] = [];
    const evidence = () =>
      new Evidence(
        pending.evidence,
        new Redactor(secrets),
        this.surface.format,
      );
    let stopping = false;
    const shutdown = async (reason: string) => {
      if (stopping) return;
      stopping = true;
      process.stdout.write(`[supervisor] stopping: ${reason}\n`);
      const results: StopResult[] = [];
      for (const cleanup of cleanups.toReversed())
        try {
          await cleanup(reason);
        } catch (error) {
          results.push({
            complete: false,
            report: [
              `cleanup failed: ${new Redactor(secrets).text(String(error))}`,
            ],
          });
        }
      for (const entry of owned)
        if (entry.pid !== process.pid && entry.pgid !== process.pid)
          results.push(
            await endProcess(
              entry,
              this.surface.stopWithinMs,
              owned.filter((member) => member.pgid === entry.pgid),
            ),
          );
      results.push(await endGroup(process.pid));
      let outcome = await this.retainStop(evidence(), new Redactor(secrets), {
        complete: results.every((result) => result.complete),
        report: results.flatMap((result) => result.report),
      });
      if (outcome.complete)
        try {
          await rm(folder, { recursive: true, force: true });
        } catch {
          outcome = await this.retainStop(evidence(), new Redactor(secrets), {
            complete: false,
            report: [
              ...outcome.report,
              'runtime cleanup failed; protected runtime retained',
            ],
          });
        }
      for (const line of outcome.report)
        process.stdout.write(`[supervisor] ${line}\n`);
      process.exit(outcome.complete ? 0 : 1);
    };
    const stop = (reason: string) => {
      shutdown(reason).catch((error: unknown) => {
        process.stdout.write(
          `[supervisor] ${new Redactor(secrets).text(String(error))}\n`,
        );
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
      own,
      onStop: (cleanup) => {
        cleanups.push(cleanup);
        own(process.pid);
      },
      stop,
      stopping: () => stopping,
    };
    try {
      const detail = await start(life);
      own(process.pid);
      this.save({
        id: pending.id,
        pid: process.pid,
        folder,
        evidence: pending.evidence,
        fingerprint: pending.fingerprint,
        startedAt: new Date().toISOString(),
        secrets,
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
  }
}

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

export type ProcessIdentity = {
  pid: number;
  pgid: number;
  command: string;
  birth: string;
};

type Running = ProcessIdentity & { state: string };

const pollMs = 100;
const killWithinMs = 5_000;

function birthOf(pid: number, started: string): string | undefined {
  if (process.platform !== 'linux') return `darwin:${started}`;
  const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const ticks = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19];
    return ticks === undefined ? undefined : `linux:${boot}:${ticks}`;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

function listed(pids?: readonly number[], pgid?: number): Running[] {
  const result = spawnSync(
    'ps',
    [
      ...(pids === undefined ? ['-A'] : ['-p', pids.join(',')]),
      '-ww',
      '-o',
      'pid=',
      '-o',
      'pgid=',
      '-o',
      'stat=',
      '-o',
      'lstart=',
      '-o',
      'args=',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, LC_ALL: 'C' },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && !(pids !== undefined && result.status === 1))
    throw new Error(
      `Could not inspect owned processes: ${result.stderr.trim()}`,
    );
  return result.stdout.split('\n').flatMap((line) => {
    const match =
      /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/.exec(
        line,
      );
    if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5])
      return [];
    const pid = Number(match[1]);
    if (pid === result.pid || (pgid !== undefined && Number(match[2]) !== pgid))
      return [];
    const birth = birthOf(pid, match[4]);
    return birth === undefined
      ? []
      : [
          {
            pid,
            pgid: Number(match[2]),
            state: match[3],
            command: match[5],
            birth,
          },
        ];
  });
}

const live = (entry: Running): boolean => !entry.state.startsWith('Z');

function matches(current: Running, captured: ProcessIdentity): boolean {
  return (
    live(current) &&
    current.pid === captured.pid &&
    current.pgid === captured.pgid &&
    current.birth === captured.birth &&
    current.command === captured.command
  );
}

export function processes(pgid?: number): Running[] {
  return listed(undefined, pgid).filter(live);
}

export function captureProcess(pid: number): ProcessIdentity | undefined {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  const entry = listed([pid]).find(live);
  if (entry === undefined) return undefined;
  const { state: _state, ...identity } = entry;
  return identity;
}

export function sameProcess(identity: ProcessIdentity): boolean {
  if (!Number.isSafeInteger(identity.pid) || identity.pid <= 0) return false;
  return listed([identity.pid]).some((entry) => matches(entry, identity));
}

export function captureGroup(identity: ProcessIdentity): ProcessIdentity[] {
  if (!sameProcess(identity)) return [];
  const group = processes(identity.pgid);
  return sameProcess(identity)
    ? group.map(({ state: _state, ...member }) => member)
    : [];
}

function signal(identity: ProcessIdentity, name: NodeJS.Signals): void {
  if (identity.pid === process.pid || !sameProcess(identity)) return;
  try {
    process.kill(identity.pid, name);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH'))
      throw error;
  }
}

async function settled(done: () => boolean, withinMs: number) {
  const deadline = Date.now() + withinMs;
  while (!done() && Date.now() < deadline) await sleep(pollMs);
  return done();
}

export async function endGroup(
  pgid: number,
  captured?: readonly ProcessIdentity[],
): Promise<string[]> {
  const members = () =>
    processes(pgid).filter((entry) => entry.pid !== process.pid);
  const initial = captured ?? (pgid === process.pid ? members() : []);
  const owned = new Map(initial.map((entry) => [entry.pid, entry]));
  if (owned.size === 0)
    return members().length === 0
      ? []
      : [`process group ${pgid} has no captured owner; it was not signalled`];
  const eligible = () => {
    const current = members();
    if (
      current.some((entry) => {
        const identity = owned.get(entry.pid);
        return identity !== undefined && matches(entry, identity);
      })
    )
      for (const entry of current)
        if (!owned.has(entry.pid)) owned.set(entry.pid, entry);
    return current.filter((entry) => {
      const identity = owned.get(entry.pid);
      return identity !== undefined && matches(entry, identity);
    });
  };
  const ending = eligible();
  if (ending.length === 0)
    return members().length === 0
      ? []
      : [
          `process group ${pgid} has no matching captured owner; it was not signalled`,
        ];
  for (const entry of ending) signal(entry, 'SIGTERM');
  if (await settled(() => members().length === 0, killWithinMs))
    return [`stopped owned process group ${pgid}`];
  for (const entry of eligible()) signal(entry, 'SIGKILL');
  const stopped = await settled(() => members().length === 0, killWithinMs);
  return [
    stopped
      ? `stopped owned process group ${pgid} after SIGKILL`
      : `process group ${pgid} still has live processes; changed or unverified identities were not signalled`,
  ];
}

export async function endProcess(
  identity: ProcessIdentity,
  withinMs: number,
  capturedGroup?: readonly ProcessIdentity[],
): Promise<string[]> {
  if (
    !Number.isSafeInteger(identity.pid) ||
    identity.pid <= 0 ||
    !Number.isSafeInteger(identity.pgid) ||
    identity.pgid <= 0
  )
    return ['invalid captured process identity; it was not signalled'];
  if (identity.pid === process.pid)
    return [`process ${identity.pid} is this command; it was not signalled`];
  const current = listed([identity.pid]).find(live);
  if (current !== undefined && !matches(current, identity))
    return [
      `process ${identity.pid} has a different identity; it was not signalled`,
    ];
  const group =
    identity.pgid === identity.pid
      ? (capturedGroup ?? captureGroup(identity)).filter(
          (entry) => entry.pgid === identity.pgid,
        )
      : undefined;
  const report: string[] = [];
  if (current !== undefined) {
    signal(identity, 'SIGTERM');
    if (!(await settled(() => !sameProcess(identity), withinMs))) {
      report.push(
        `process ${identity.pid} did not stop within ${withinMs} ms after SIGTERM`,
      );
      if (group === undefined) {
        signal(identity, 'SIGKILL');
        if (!(await settled(() => !sameProcess(identity), killWithinMs)))
          report.push(`process ${identity.pid} is still running after SIGKILL`);
      }
    }
  }
  if (group !== undefined)
    return [...report, ...(await endGroup(identity.pgid, group))];
  const left = listed([identity.pid]).find(live);
  if (left !== undefined && !matches(left, identity))
    report.push(
      `process ${identity.pid} has a different identity; it was not signalled`,
    );
  return report;
}

export async function endLeader(
  pid: number,
  marker: string,
  withinMs: number,
  captured?: ProcessIdentity,
  capturedGroup?: readonly ProcessIdentity[],
): Promise<string[]> {
  if (pid === process.pid)
    return [`process ${pid} is this command; it was not signalled`];
  const leader = listed([pid]).find(live);
  if (leader !== undefined && !leader.command.includes(marker))
    return [
      `process ${pid} is not this instance's supervisor; it was not signalled`,
    ];
  if (captured === undefined)
    return [`process ${pid} has no captured owner; it was not signalled`];
  if (captured.pid !== pid || !captured.command.includes(marker))
    return [
      `process ${pid} does not match the captured supervisor; it was not signalled`,
    ];
  return endProcess(captured, withinMs, capturedGroup);
}

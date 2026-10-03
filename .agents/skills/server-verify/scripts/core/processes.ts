import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

type Running = { pid: number; pgid: number; command: string };

const pollMs = 100;
const killWithinMs = 5_000;

export function processes(): Running[] {
  const listed = spawnSync(
    'ps',
    ['-A', '-ww', '-o', 'pid=', '-o', 'pgid=', '-o', 'args='],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (listed.error) throw listed.error;
  return listed.stdout.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    return match?.[1] &&
      match[2] &&
      match[3] !== undefined &&
      Number(match[1]) !== listed.pid
      ? [{ pid: Number(match[1]), pgid: Number(match[2]), command: match[3] }]
      : [];
  });
}

export function isOurs(pid: number, marker: string): boolean {
  return processes().some(
    (entry) => entry.pid === pid && entry.command.includes(marker),
  );
}

function signal(target: number, name: NodeJS.Signals): void {
  try {
    process.kill(target, name);
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

export async function endGroup(pgid: number): Promise<string[]> {
  const members = () =>
    processes().filter(
      (entry) => entry.pgid === pgid && entry.pid !== process.pid,
    );
  const left = members();
  if (left.length === 0) return [];
  const count = `${left.length} process${left.length === 1 ? '' : 'es'}`;
  for (const entry of left) signal(entry.pid, 'SIGTERM');
  if (await settled(() => members().length === 0, killWithinMs))
    return [`stopped ${count} left in process group ${pgid}`];
  for (const entry of members()) signal(entry.pid, 'SIGKILL');
  await settled(() => members().length === 0, killWithinMs);
  return [
    `sent SIGKILL to process group ${pgid}, which still held ${count} after SIGTERM`,
  ];
}

export async function endLeader(
  pid: number,
  marker: string,
  withinMs: number,
): Promise<string[]> {
  const leader = processes().find((entry) => entry.pid === pid);
  if (leader !== undefined && !leader.command.includes(marker))
    return [
      `process ${pid} is not this instance's supervisor (its command line is ${JSON.stringify(leader.command.slice(0, 120))}); it was not signalled`,
    ];
  const report: string[] = [];
  if (leader !== undefined) {
    signal(pid, 'SIGTERM');
    if (!(await settled(() => !isOurs(pid, marker), withinMs)))
      report.push(
        `the supervisor ${pid} did not stop within ${withinMs} ms after SIGTERM`,
      );
  }
  return [...report, ...(await endGroup(pid))];
}

export async function endMatching(marker: string): Promise<string[]> {
  const matching = () =>
    processes().filter((entry) => entry.command.includes(marker));
  const found = matching();
  if (found.length === 0) return [];
  const targets = (entries: readonly Running[]) =>
    entries.map((entry) => (entry.pgid === entry.pid ? -entry.pid : entry.pid));
  for (const target of targets(found)) signal(target, 'SIGTERM');
  if (await settled(() => matching().length === 0, killWithinMs))
    return [`stopped ${found.length} leftover process(es) matching ${marker}`];
  for (const target of targets(matching())) signal(target, 'SIGKILL');
  return [`sent SIGKILL to leftover process(es) matching ${marker}`];
}

import { Schema } from 'effect';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { linkSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export const poolProcessSchema = Schema.Struct({
  pid: Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
  birth: Schema.String,
});
type PoolProcess = typeof poolProcessSchema.Type;
const claimSchema = Schema.Struct({
  owner: Schema.String,
  process: poolProcessSchema,
});
export type PoolClaim = typeof claimSchema.Type;

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function poolProcess(pid = process.pid): PoolProcess | undefined {
  const result = spawnSync(
    'ps',
    ['-p', String(pid), '-o', 'stat=', '-o', 'lstart='],
    {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C' },
    },
  );
  if (result.error) throw result.error;
  if (result.status === 1 && result.stdout.trim() === '') return undefined;
  if (result.status !== 0)
    throw new Error(
      `Could not inspect simulator pool owner ${pid}: ${result.stderr.trim()}`,
    );
  const match = /^\s*(\S+)\s+(.+?)\s*$/.exec(result.stdout);
  if (match?.[1] === undefined || match[2] === undefined)
    throw new Error(`Could not read simulator pool owner ${pid}'s start time.`);
  if (match[1].startsWith('Z')) return undefined;
  if (process.platform !== 'linux') return { pid, birth: `darwin:${match[2]}` };
  try {
    const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const ticks = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19];
    if (ticks === undefined)
      throw new Error(`Could not read process ${pid}'s start ticks.`);
    return { pid, birth: `linux:${boot}:${ticks}` };
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
}

export function readPoolClaim(path: string): PoolClaim | undefined {
  try {
    return Schema.decodeUnknownSync(claimSchema)(
      JSON.parse(readFileSync(path, 'utf8')),
    );
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
}

function sameClaim(left: PoolClaim, right: PoolClaim): boolean {
  return (
    left.owner === right.owner &&
    left.process.pid === right.process.pid &&
    left.process.birth === right.process.birth
  );
}

export function poolClaimAlive(claim: PoolClaim): boolean {
  return poolProcess(claim.process.pid)?.birth === claim.process.birth;
}

export function removeStalePoolClaim(path: string): boolean {
  const claim = readPoolClaim(path);
  if (claim === undefined || poolClaimAlive(claim)) return false;
  const current = readPoolClaim(path);
  if (current === undefined || !sameClaim(current, claim)) return false;
  rmSync(path);
  process.stderr.write(
    `Recovered stale simulator pool file ${path}: owner process ${claim.process.pid} is gone or has a different start time.\n`,
  );
  return true;
}

export function claimPoolFile(path: string, owner: string): PoolClaim {
  const identity = poolProcess();
  if (identity === undefined)
    throw new Error('Could not capture the simulator pool owner.');
  const claim = { owner, process: identity };
  const temporary = `${path}.${randomUUID()}.partial`;
  writeFileSync(temporary, JSON.stringify(claim), { flag: 'wx', mode: 0o600 });
  try {
    try {
      linkSync(temporary, path);
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          'code' in error &&
          error.code === 'EEXIST'
        ) ||
        !removeStalePoolClaim(path)
      )
        throw error;
      linkSync(temporary, path);
    }
  } finally {
    rmSync(temporary);
  }
  return claim;
}

export function assertPoolOwner(path: string, expected: PoolClaim): void {
  const claim = readPoolClaim(path);
  if (claim === undefined || !sameClaim(claim, expected))
    throw new Error(
      `Refused to release ${path}: this run does not own its claim.`,
    );
}

export function releasePoolFile(path: string, expected: PoolClaim): void {
  assertPoolOwner(path, expected);
  rmSync(path);
}

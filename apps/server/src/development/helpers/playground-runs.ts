import { execFile } from 'node:child_process';
import { lstat, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ownerFile = 'owner.json';

/** Records the process that owns a run or cache build so abandoned ones can be pruned. */
export async function claimDirectory(directory: string) {
  await writeFile(
    join(directory, ownerFile),
    `${JSON.stringify({ pid: process.pid, host: hostname() })}\n`,
  );
}

function running(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function abandoned(directory: string) {
  try {
    const owner = JSON.parse(
      await readFile(join(directory, ownerFile), 'utf8'),
    ) as { pid?: unknown; host?: unknown };
    return (
      typeof owner.pid === 'number' &&
      owner.host === hostname() &&
      !running(owner.pid)
    );
  } catch {
    // No owner record: an older run, or one still being created. Leave it alone.
    return false;
  }
}

/** Removes entries whose recorded owner process has exited on this host. */
export async function pruneAbandoned(
  parent: string,
  matches: (name: string) => boolean,
) {
  let names: string[];
  try {
    names = await readdir(parent);
  } catch {
    return;
  }
  for (const name of names.filter(matches)) {
    const directory = join(parent, name);
    if (await abandoned(directory)) await removeTree(directory);
  }
}

/**
 * Worktrees with installed dependencies hold hundreds of thousands of files.
 * Parallel native removal keeps shutdown in seconds; fs.rm is the fallback.
 */
export async function removeTree(path: string) {
  const paths: string[] = [];
  try {
    for (const name of await readdir(path)) {
      const child = join(path, name);
      if ((await lstat(child)).isDirectory())
        for (const nested of await readdir(child))
          paths.push(join(child, nested));
      else paths.push(child);
    }
  } catch {
    // Missing or partially removed; the final removal below still applies.
  }
  const groups = Array.from({ length: 8 }, (_, group) =>
    paths.filter((_, index) => index % 8 === group),
  ).filter((group) => group.length);
  try {
    await Promise.all(
      groups.map((group) => promisify(execFile)('rm', ['-rf', '--', ...group])),
    );
  } catch {
    // Fall through to the portable removal.
  }
  await rm(path, { recursive: true, force: true });
}

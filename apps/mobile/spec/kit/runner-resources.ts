import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const commands: readonly (readonly [string, ...string[]])[] = [
  ['vm_stat'],
  ['memory_pressure', '-Q'],
  [
    'top',
    '-l',
    '2',
    '-s',
    '1',
    '-n',
    '15',
    '-o',
    'cpu',
    '-stats',
    'pid,command,cpu,mem,threads',
  ],
  ['ps', '-axo', 'pid,ppid,%cpu,rss,comm'],
  ['xcrun', 'simctl', 'list', 'devices', 'booted', '--json'],
];

export function runnerResources(folder: string) {
  let pending = Promise.resolve();
  const snapshot = (stage: string): Promise<void> => {
    if (process.env.CI !== 'true') return Promise.resolve();
    const capture = async () => {
      const began = Date.now();
      let output = `\n${new Date(began).toISOString()} ${stage}\n${JSON.stringify({ cpus: cpus().length, load: loadavg(), freeBytes: freemem(), totalBytes: totalmem() })}\n`;
      for (const [command, ...args] of commands) {
        output += `\n$ ${[command, ...args].join(' ')}\n`;
        try {
          const result = await execute(command, args, {
            timeout: 5000,
            maxBuffer: 1024 * 1024,
          });
          output += result.stdout + result.stderr;
        } catch (error) {
          output += `Resource command failed: ${String(error)}\n`;
        }
      }
      output += `Sample completed ${new Date().toISOString()} (${Date.now() - began}ms)\n`;
      await appendFile(join(folder, 'resources.log'), output);
    };
    pending = pending.then(capture, capture);
    return pending;
  };
  const timer =
    process.env.CI === 'true'
      ? setInterval(() => {
          void snapshot('periodic').catch((error: unknown) =>
            console.error(error),
          );
        }, 30_000).unref()
      : undefined;
  return {
    snapshot,
    async stop() {
      clearInterval(timer);
      await pending;
    },
  };
}

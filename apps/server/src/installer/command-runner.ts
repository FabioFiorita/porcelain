import { execFile } from 'node:child_process';

export type CommandResult = { code: number; stdout: string; stderr: string };

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string | undefined },
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    execFile(
      command,
      [...args],
      {
        cwd: options?.cwd,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        resolve({
          code: typeof error.code === 'number' ? error.code : 1,
          stdout,
          stderr: stderr.length > 0 ? stderr : error.message,
        });
      },
    );
  });

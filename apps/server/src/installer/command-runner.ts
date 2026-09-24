import { runCommand as runProcess } from '@porcelain/process';

export type CommandResult = { code: number; stdout: string; stderr: string };

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string | undefined },
) => Promise<CommandResult>;

export const runCommand: CommandRunner = async (command, args, options) => {
  try {
    const output = await runProcess({
      command,
      args,
      cwd: options?.cwd,
      timeoutMs: 60_000,
      maxBytes: 1024 * 1024,
    });
    const stdout = output.stdout.toString('utf8');
    const stderr = output.stderr.toString('utf8');
    const completed =
      output.stopped === undefined || output.stopped === 'lingering';
    if (completed && output.exitCode === 0) return { code: 0, stdout, stderr };
    return {
      code: output.exitCode || 1,
      stdout,
      stderr:
        stderr.length > 0
          ? stderr
          : `Command failed: ${[command, ...args].join(' ')}`,
    };
  } catch (error) {
    return {
      code: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
};

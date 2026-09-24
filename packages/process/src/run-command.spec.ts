import { describe, expect, it } from 'vitest';
import { runCommand } from './run-command.ts';

const node = process.execPath;
const forever = 'setInterval(() => {}, 1000)';
const spawnGrandchild = `const child = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(forever)}], { stdio: 'ignore' }); child.unref(); process.stderr.write(String(child.pid));`;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('runCommand', () => {
  it('returns what the command printed, having fed it the input', async () => {
    const output = await runCommand({
      command: node,
      args: [
        '-e',
        "process.stdin.pipe(process.stdout); process.stderr.write('note')",
      ],
      stdin: 'hello',
      maxBytes: 1024,
    });
    expect({
      stdout: output.stdout.toString('utf8'),
      stderr: output.stderr.toString('utf8'),
      exitCode: output.exitCode,
      stopped: output.stopped,
    }).toEqual({
      stdout: 'hello',
      stderr: 'note',
      exitCode: 0,
      stopped: undefined,
    });
  });

  it('returns a non-zero exit as a fact instead of throwing', async () => {
    const output = await runCommand({
      command: node,
      args: ['-e', 'process.exit(3)'],
      maxBytes: 1024,
    });
    expect(output.exitCode).toBe(3);
  });

  it('kills the child and the grandchild it started when the caller aborts', async () => {
    const controller = new AbortController();
    let grandchild = 0;
    const output = await runCommand(
      {
        command: node,
        args: ['-e', `${spawnGrandchild} ${forever}`],
        maxBytes: 1024,
        onStderr: (chunk) => {
          grandchild = Number(chunk.toString('utf8'));
          controller.abort();
        },
      },
      controller.signal,
    );
    expect({
      stopped: output.stopped,
      groupStopped: output.groupStopped,
      grandchildRunning: isRunning(grandchild),
    }).toEqual({
      stopped: 'aborted',
      groupStopped: true,
      grandchildRunning: false,
    });
  });

  it('kills a grandchild left running after the child exits', async () => {
    const output = await runCommand({
      command: node,
      args: ['-e', spawnGrandchild],
      maxBytes: 1024,
    });
    const grandchild = Number(output.stderr.toString('utf8'));
    expect({
      exitCode: output.exitCode,
      stopped: output.stopped,
      groupStopped: output.groupStopped,
      grandchildRunning: isRunning(grandchild),
    }).toEqual({
      exitCode: 0,
      stopped: 'lingering',
      groupStopped: true,
      grandchildRunning: false,
    });
  });

  it('stops a command whose output passes the byte cap and keeps no more than the cap', async () => {
    const output = await runCommand({
      command: node,
      args: ['-e', `process.stdout.write('x'.repeat(4096)); ${forever}`],
      maxBytes: 16,
    });
    expect(output.stopped).toBe('output-limit');
    expect(output.stdout.length).toBeLessThanOrEqual(16);
  });

  it('keeps the first bytes of stderr past the byte cap, marks it truncated and lets the command finish', async () => {
    const output = await runCommand({
      command: node,
      args: [
        '-e',
        "process.stderr.write('e'.repeat(4096)); process.stdout.write('plan'); process.exitCode = 0",
      ],
      maxBytes: 16,
    });
    expect({
      stdout: output.stdout.toString('utf8'),
      stderr: output.stderr.toString('utf8'),
      stderrTruncated: output.stderrTruncated,
      exitCode: output.exitCode,
      stopped: output.stopped,
    }).toEqual({
      stdout: 'plan',
      stderr: 'e'.repeat(16),
      stderrTruncated: true,
      exitCode: 0,
      stopped: undefined,
    });
  });

  it('stops a command that outlives its deadline', async () => {
    const output = await runCommand({
      command: node,
      args: ['-e', forever],
      timeoutMs: 100,
      maxBytes: 1024,
    });
    expect([output.stopped, output.exitCode]).toEqual(['deadline', undefined]);
  });

  it('refuses to start once the caller has aborted', async () => {
    await expect(
      runCommand(
        { command: node, args: ['-e', ''], maxBytes: 1024 },
        AbortSignal.abort(),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

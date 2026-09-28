import { spawn } from 'node:child_process';

const commands = [
  'typecheck:server',
  'typecheck:web',
  'lint:server',
  'lint:web',
  'format:server:check',
  'format:web:check',
  'arch:check',
  'test',
  'test:rules',
];
const started = performance.now();
const results = await Promise.all(
  commands.map(
    (command) =>
      new Promise<boolean>((done, fail) => {
        const since = performance.now();
        const child = spawn('pnpm', command.split(' '), {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const output: Buffer[] = [];
        child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => output.push(chunk));
        child.once('error', fail);
        child.once('close', (status) => {
          const passed = status === 0;
          process.stdout.write(
            `${passed ? 'PASS' : 'FAIL'} ${command} (${Math.round(performance.now() - since)} ms)\n`,
          );
          if (!passed)
            process.stderr.write(Buffer.concat(output).toString('utf8'));
          done(passed);
        });
      }),
  ),
);
process.stdout.write(
  `Fast checks: ${Math.round(performance.now() - started)} ms.\n`,
);
process.exitCode = results.every(Boolean) ? 0 : 1;

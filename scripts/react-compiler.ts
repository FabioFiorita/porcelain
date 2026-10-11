import { transformSync } from '@babel/core';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const mobileCompilerOptions = { panicThreshold: 'all_errors' } as const;

export function reactCompilerProblems(path: string, source: string): string[] {
  try {
    transformSync(source, {
      filename: path,
      configFile: false,
      babelrc: false,
      code: false,
      highlightCode: false,
      parserOpts: {
        plugins: path.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
      },
      plugins: [['babel-plugin-react-compiler', mobileCompilerOptions]],
    });
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const line =
      message.match(/^>\s*(\d+)\s*\|/m)?.[1] ??
      message.match(/\((\d+):\d+\)/)?.[1];
    return [
      `${path}${line ? `:${line}` : ''}: Mobile source must compile with React Compiler, because all_errors makes a compiler bailout fail the Metro bundle.\n${message}`,
    ];
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = performance.now();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = globSync('apps/mobile/src/**/*.{ts,tsx}', { cwd: root }).sort();
  const problems = files.flatMap((path) =>
    reactCompilerProblems(path, readFileSync(join(root, path), 'utf8')),
  );
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.stdout.write(
    `React Compiler: ${problems.length} problems; ${files.length} mobile source files checked in ${Math.round(performance.now() - started)} ms.\n`,
  );
  process.exitCode = problems.length > 0 ? 1 : 0;
}

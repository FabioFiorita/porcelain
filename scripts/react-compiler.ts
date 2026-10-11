import { transformSync } from '@babel/core';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = join(root, 'apps/mobile');
const platforms = ['ios', 'android'] as const;

export function reactCompilerProblems(
  path: string,
  source: string,
  platform: (typeof platforms)[number] = 'ios',
): string[] {
  const caller = {
    name: 'metro',
    bundler: 'metro',
    platform,
    isDev: true,
    isServer: false,
    isReactServer: false,
    isNodeModule: false,
    isHMREnabled: true,
    supportsStaticESM: false,
    supportsReactCompiler: true,
    engine: 'hermes',
    projectRoot: mobileRoot,
    routerRoot: 'src/app',
  };
  try {
    transformSync(source, {
      cwd: mobileRoot,
      filename: resolve(root, path),
      configFile: join(mobileRoot, 'babel.config.js'),
      babelrc: false,
      code: false,
      highlightCode: false,
      caller,
    });
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const line =
      message.match(/^>\s*(\d+)\s*\|/m)?.[1] ??
      message.match(/\((\d+):\d+\)/)?.[1];
    return [
      `${path}${line ? `:${line}` : ''}: Mobile source must compile with React Compiler for ${platform}, because all_errors makes a compiler bailout fail the Metro bundle.\n${message}`,
    ];
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = performance.now();
  const files = globSync('apps/mobile/src/**/*.{ts,tsx}', {
    cwd: root,
    exclude: ['**/*.spec.ts', '**/*.d.ts'],
  }).sort();
  const problems =
    files.length === 0
      ? [
          'Mobile React Compiler: no source files found, because an empty check cannot protect Metro bundling.',
        ]
      : files.flatMap((path) => {
          const source = readFileSync(join(root, path), 'utf8');
          return platforms.flatMap((platform) =>
            reactCompilerProblems(path, source, platform),
          );
        });
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.stdout.write(
    `Mobile React Compiler: ${problems.length} problems; ${files.length} source files checked for ${platforms.join(' and ')} in ${Math.round(performance.now() - started)} ms.\n`,
  );
  process.exitCode = problems.length > 0 ? 1 : 0;
}

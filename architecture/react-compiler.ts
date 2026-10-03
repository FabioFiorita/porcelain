import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { transformAsync } from '@babel/core';
import reactCompiler, {
  type LoggerEvent,
  type PluginOptions,
} from 'babel-plugin-react-compiler';

export type CompilerFinding = { file: string; line: number; message: string };

const optOut = /^\s*['"]use no (?:memo|forget)['"]/m;

async function compile(
  file: string,
  source: string,
  options: PluginOptions,
): Promise<void> {
  await transformAsync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    code: false,
    parserOpts: {
      plugins: file.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    },
    plugins: [[reactCompiler, options]],
  });
}

function reason(event: LoggerEvent): string | undefined {
  if (event.kind === 'PipelineError')
    return event.data.split('\n')[0] ?? event.data;
  return event.kind === 'CompileError' ? event.detail.reason : undefined;
}

async function failures(
  file: string,
  source: string,
): Promise<CompilerFinding[]> {
  const found = new Map<string, CompilerFinding>();
  await compile(file, source, {
    panicThreshold: 'none',
    ignoreUseNoForget: true,
    logger: {
      logEvent(_filename, event) {
        const why = reason(event);
        if (why === undefined || !('fnLoc' in event)) return;
        const line = event.fnLoc?.start.line ?? 1;
        const key = `${line}:${event.fnLoc?.start.column ?? 0}`;
        if (!found.has(key))
          found.set(key, {
            file,
            line,
            message: `the React Compiler cannot compile this function because ${why}`,
          });
      },
    },
  });
  return [...found.values()];
}

export async function compilerFindings(
  files: readonly string[],
): Promise<CompilerFinding[]> {
  const findings: CompilerFinding[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (optOut.test(source))
      findings.push({
        file,
        line: 1,
        message:
          'a use no memo directive hides a component from the React Compiler; make the component compile instead, because the shipped build must compile every component',
      });
    try {
      await compile(file, source, {
        panicThreshold: 'all_errors',
        ignoreUseNoForget: true,
      });
    } catch (error) {
      const found = await failures(file, source);
      findings.push(
        ...(found.length > 0
          ? found
          : [
              {
                file,
                line: 1,
                message: `the React Compiler cannot compile this file because ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
              },
            ]),
      );
    }
  }
  return findings;
}

const buildPluginSchema = z.object({
  name: z.literal('@rolldown/plugin-babel'),
  configResolved: z.custom<(...arguments_: unknown[]) => unknown>(
    (value) => typeof value === 'function',
  ),
  applyToEnvironment: z.custom<(...arguments_: unknown[]) => unknown>(
    (value) => typeof value === 'function',
  ),
  transform: z.object({
    handler: z.custom<(...arguments_: unknown[]) => unknown>(
      (value) => typeof value === 'function',
    ),
  }),
});

export async function buildCompilerRuns(module: unknown): Promise<boolean> {
  const config = z
    .object({ default: z.object({ plugins: z.array(z.unknown()) }) })
    .safeParse(module);
  if (!config.success) return false;
  const pending = [...config.data.default.plugins];
  while (pending.length > 0) {
    const value: unknown = await pending.shift();
    const list = z.array(z.unknown()).safeParse(value);
    if (list.success) {
      pending.push(...list.data);
      continue;
    }
    const parsed = buildPluginSchema.safeParse(value);
    if (!parsed.success) continue;
    const plugin = parsed.data;
    const environment = { name: 'client', config: { consumer: 'client' } };
    plugin.configResolved({ command: 'build', isProduction: true });
    if (!plugin.applyToEnvironment(environment)) continue;
    const source =
      'export function GuardrailFixture({label}) { return <p>{label.trim()}</p>; }';
    const transformed = await plugin.transform.handler.call(
      {
        environment,
        error(problem: { message: string }) {
          throw new Error(problem.message);
        },
      },
      source,
      resolve('apps/web/src/guardrail-fixture.tsx'),
      { moduleType: 'tsx' },
    );
    const result = z.object({ code: z.string() }).safeParse(transformed);
    if (result.success && result.data.code.includes('react/compiler-runtime'))
      return true;
  }
  return false;
}

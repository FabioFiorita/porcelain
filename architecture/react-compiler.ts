import { readFileSync } from 'node:fs';
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
            message: `the React Compiler cannot compile this function: ${why}`,
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
          'a use no memo directive hides a component from the React Compiler; make the component compile instead',
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
                message: `the React Compiler cannot compile this file: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
              },
            ]),
      );
    }
  }
  return findings;
}

import { resolve } from 'node:path';

export function scriptInvokes(
  source: string,
  required: readonly (readonly string[])[],
  folder: string,
): boolean {
  const tokens = [
    ...source.matchAll(/'([^']*)'|"([^"]*)"|(&&)|([^\s'"&;|<>]+)/g),
  ].map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? '');
  if (tokens.join(' ').replaceAll(' ', '') !== source.replace(/['"\s]/g, ''))
    return false;
  const steps: string[][] = [[]];
  for (const token of tokens) {
    if (token === '&&') steps.push([]);
    else if (/[;|<>`$]/.test(token)) return false;
    else steps.at(-1)?.push(token);
  }
  const normalize = (token: string) =>
    /^(?:\.\.?\/|scripts\/|architecture\/)/.test(token) ||
    /\.(?:ts|mjs|cjs|json)$/.test(token)
      ? resolve(folder, token)
      : token;
  return required.every(([executable, ...arguments_]) =>
    steps.some(([command, ...actual]) => {
      if (command !== executable) return false;
      if (
        actual.some((argument) =>
          ['--help', '-h', '--version', '-v'].includes(argument),
        )
      )
        return false;
      if (
        executable === 'tsc' &&
        actual.includes('-p') !== arguments_.includes('-p')
      )
        return false;
      if (actual.includes('--noCheck') || actual.includes('--passWithNoTests'))
        return false;
      const selectors = ['-p', '--config', '--project', '--filter'];
      for (const option of selectors) {
        const values = (arguments_: readonly string[]) =>
          arguments_.flatMap((argument, index) =>
            argument === option ? [normalize(arguments_[index + 1] ?? '')] : [],
          );
        const expected = values(arguments_).toSorted();
        const found = values(actual).toSorted();
        if (expected.join('\n') !== found.join('\n')) return false;
      }
      const normalized = actual.map(normalize);
      if (
        executable === 'node' &&
        normalize(actual[0] ?? '') !== normalize(arguments_[0] ?? '')
      )
        return false;
      if (
        actual.some((argument) =>
          ['--list', '--dry-run', '--dry'].includes(argument),
        )
      )
        return false;
      if (actual.includes('--check') !== arguments_.includes('--check'))
        return false;
      if (actual[actual.indexOf('--noEmit') + 1] === 'false') return false;
      return arguments_.every((argument) =>
        normalized.includes(normalize(argument)),
      );
    }),
  );
}

export const localCheckCommand =
  'turbo run typecheck lint:server lint:web format:server:check format:web:check arch:check test:rules probes:check features:check --output-logs=errors-only --continue --concurrency=2';

export function localCheckMatches(source: string): boolean {
  return source.trim().split(/\s+/).join(' ') === localCheckCommand;
}

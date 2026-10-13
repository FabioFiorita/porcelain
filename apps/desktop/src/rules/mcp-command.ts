import { resolve } from 'node:path';

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function desktopMcpCommand(
  executable: string,
  entry: string | undefined,
  dataDirectory: string,
): string {
  const arguments_ = [resolve(executable)];
  if (entry !== undefined) arguments_.push(resolve(entry));
  arguments_.push(
    '--porcelain-mcp',
    '--data-directory',
    resolve(dataDirectory),
  );
  return `claude mcp add porcelain -- ${arguments_.map(shellQuote).join(' ')}`;
}

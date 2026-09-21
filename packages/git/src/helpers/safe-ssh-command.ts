/**
 * A repository may select one SSH identity. Anything else in `core.sshCommand`
 * can replace the command Porcelain runs, so it stays unsupported.
 */
export function safeSshIdentity(command: string): { identity?: string } | null {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] !== 'ssh') return null;
  let identity: string | undefined;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-i') {
      index += 1;
      const path = tokens[index];
      if (identity || !path || !isIdentityPath(path)) return null;
      identity = path;
      continue;
    }
    if (token === '-o') {
      index += 1;
      if (tokens[index] !== 'IdentitiesOnly=yes') return null;
      continue;
    }
    return null;
  }
  return { ...(identity ? { identity } : {}) };
}

function isIdentityPath(path: string) {
  return (
    /^[~./A-Za-z0-9_-]+$/.test(path) &&
    !path.split('/').some((part) => part === '..')
  );
}

/** Quote one argument for the shell that runs `GIT_SSH_COMMAND`. */
export function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

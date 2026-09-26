export function worktreePath(worktreeId: string) {
  return `/api/worktrees/${encodeURIComponent(worktreeId)}`;
}

export function queryString(
  values: Record<string, string | number | undefined>,
) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) parameters.set(key, String(value));
  return parameters.size === 0 ? '' : `?${parameters}`;
}

export function jsonBody(body: unknown) {
  return {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

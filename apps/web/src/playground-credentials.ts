export async function readPlaygroundCredentials(
  signal = AbortSignal.timeout(5000),
) {
  const response = await fetch('/__porcelain/playground', {
    method: 'POST',
    headers: { 'x-porcelain-playground': '1' },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw new Error('Playground credentials are unavailable.');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !('tokenFile' in value) ||
    typeof value.tokenFile !== 'string'
  )
    throw new Error('Invalid playground credentials.');
  return { token: value.token, tokenFile: value.tokenFile };
}

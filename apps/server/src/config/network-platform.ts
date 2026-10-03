export function readNetworkPlatform(): 'darwin' | 'linux' {
  return process.platform === 'darwin' ? 'darwin' : 'linux';
}

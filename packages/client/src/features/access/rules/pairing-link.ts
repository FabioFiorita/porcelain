export type PairingCode = { code: string; environmentId: string };

export function parsePairingLink(fragment: string): PairingCode | null {
  const values = new URLSearchParams(fragment.replace(/^#/, ''));
  const code = values.get('c');
  const environmentId = values.get('e');
  return code && environmentId ? { code, environmentId } : null;
}

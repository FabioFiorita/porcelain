import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ServerHandle } from '../../../../apps/server/spec/kit/isolated-server.ts';
import type { ServerInstance } from './instance.ts';

export async function connection(instance: ServerInstance): Promise<string> {
  const handle = await ServerHandle.attach(instance.detail.manifestPath);
  const network = join(instance.folder, 'curl-network.conf');
  const owner = join(instance.folder, 'curl-owner.conf');
  for (const [path, content] of [
    [
      network,
      `header = ${JSON.stringify(`Authorization: Bearer ${handle.credential}`)}\n`,
    ],
    [owner, `unix-socket = ${JSON.stringify(handle.socketPath)}\n`],
  ] as const) {
    await writeFile(path, content, { mode: 0o600 });
    await chmod(path, 0o600);
  }
  return `${JSON.stringify(
    {
      instance: instance.id,
      address: instance.detail.address,
      projectId: instance.detail.projectId,
      worktreeId: instance.detail.worktreeId,
      repository: instance.detail.repository,
      home: instance.detail.projectHome,
      ownerSocket: handle.socketPath,
      curl: { network, owner },
      startedAt: instance.startedAt,
      fingerprint: instance.fingerprint,
      evidence: instance.evidence,
    },
    null,
    2,
  )}\n`;
}

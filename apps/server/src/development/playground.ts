import { rm } from 'node:fs/promises';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { startLocalServer } from '../lifecycle/start-local-server.ts';
import { createPlayground } from './create-playground.ts';

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  const fixture = await createPlayground();
  try {
    // This dedicated development process starts with an isolated Git environment.
    for (const key of Object.keys(process.env))
      if (/^(GIT_|SSH_)/.test(key)) delete process.env[key];
    Object.assign(process.env, fixture.environment);
    const server = await startLocalServer(
      {
        dataDirectory: fixture.dataDirectory,
        token: fixture.token,
        port: 0,
        apiDocumentation: true,
      },
      shutdown.signal,
    );
    try {
      const response = await fetch(`${server.address}/projects`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${fixture.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: fixture.project }),
        signal: shutdown.signal,
      });
      if (!response.ok)
        throw new Error('Could not register playground repository');
      const project = projectResponseSchema.parse(await response.json());
      process.stdout.write(
        `${JSON.stringify({
          documentation: `${server.address}/documentation/`,
          tokenFile: fixture.tokenFile,
          projectId: project.id,
          worktreeId: project.worktrees.find((worktree) => !worktree.main)?.id,
          projectPath: fixture.project,
          worktreePath: fixture.worktree,
          cleanup:
            'Ctrl+C stops the server and removes this disposable playground.',
        })}\n`,
      );
      if (!shutdown.signal.aborted)
        await new Promise<void>((resolve) =>
          shutdown.signal.addEventListener('abort', () => resolve(), {
            once: true,
          }),
        );
    } finally {
      await server.close();
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
} catch {
  if (!shutdown.signal.aborted) {
    process.stderr.write(
      'Playground startup failed. Check that Git is installed.\n',
    );
    process.exitCode = 1;
  }
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

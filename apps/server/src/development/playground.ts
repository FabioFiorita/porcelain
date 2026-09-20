import { randomUUID } from 'node:crypto';
import { mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { NodeFileWriter } from '../filesystem/file-writer.ts';
import { startRuntime } from '../lifecycle/runtime.ts';
import { createPlayground, removePlayground } from './create-playground.ts';
import { seedPlaygroundReview } from './helpers/seed-playground-review.ts';
import { hasSyntheticBase } from './helpers/synthetic-base.ts';
import { pairThroughSocket } from './pair-through-socket.ts';
import { isPlaygroundProfileName, playgroundProfiles } from './profiles.ts';

const profile = process.env.PORCELAIN_PLAYGROUND_PROFILE || 'fixture';
if (!isPlaygroundProfileName(profile)) {
  process.stderr.write(
    `Unknown playground profile "${profile}". Choose one of: ${Object.keys(playgroundProfiles).join(', ')}.\n`,
  );
  process.exit(1);
}
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  const parent = process.env.PORCELAIN_PLAYGROUND_DIRECTORY || tmpdir();
  const started = performance.now();
  const { synthetic } = playgroundProfiles[profile];
  if (synthetic)
    process.stderr.write(
      (await hasSyntheticBase(join(parent, '.cache'), profile, synthetic))
        ? `Preparing the ${profile} playground from its cached base...\n`
        : `Generating the ${profile} playground base; later runs reuse it...\n`,
    );
  const fixture = await createPlayground(parent, {
    profile,
    signal: shutdown.signal,
  });
  if (synthetic)
    process.stderr.write(
      `Playground ready in ${((performance.now() - started) / 1000).toFixed(1)} s.\n`,
    );
  try {
    // This dedicated development process starts with an isolated Git environment.
    for (const key of Object.keys(process.env))
      if (/^(GIT_|SSH_)/.test(key)) delete process.env[key];
    Object.assign(process.env, fixture.environment);
    const server = await startRuntime(
      {
        dataDirectory: fixture.dataDirectory,
        // Discovery stays inside the disposable playground, never a real home.
        projectHome: fixture.root,
        port: 0,
      },
      shutdown.signal,
      {
        commitGenerator: {
          async models() {
            return [
              { id: 'codex:gpt-5.6-luna', label: 'Disposable fixture model' },
            ];
          },
          async generate(_model, prompt) {
            const paths = JSON.parse(
              prompt.split('Selected paths: ')[1]?.split('\n')[0] ?? '[]',
            ) as string[];
            return prompt.startsWith('Write exactly')
              ? [{ message: 'Review workspace changes', paths }]
              : paths.map((path) => ({
                  message: `Update ${path}`,
                  paths: [path],
                }));
          },
        },
        fileWriter: new NodeFileWriter(async (paths) => {
          const directory = join(fixture.root, 'trash');
          await mkdir(directory, { recursive: true });
          for (const path of paths)
            await rename(
              path,
              join(directory, `${randomUUID()}-${basename(path)}`),
            );
        }),
      },
    );
    try {
      // The playground pairs itself like any other device: there is no shared
      // secret to seed with, so it redeems a grant of its own through the
      // owner socket and uses that credential.
      const seeding = await pairThroughSocket(
        server.socketPath,
        server.address,
        'Playground seeding',
      );
      const response = await fetch(`${server.address}/api/projects`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${seeding}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: fixture.project }),
        signal: shutdown.signal,
      });
      if (!response.ok)
        throw new Error('Could not register playground repository');
      const project = projectResponseSchema.parse(await response.json());
      const worktreeId = project.worktrees.find(
        (worktree) => worktree.branch === 'refs/heads/review',
      )?.id;
      if (!worktreeId)
        throw new Error('Playground review worktree was not registered');
      await seedPlaygroundReview(
        server.address,
        seeding,
        project.id,
        worktreeId,
        fixture.reviewCommitOid,
        shutdown.signal,
      );
      process.stdout.write(
        `${JSON.stringify({
          address: server.address,
          // The manifest carries no secret and no reusable grant. A caller that
          // needs access asks this socket for a one-use link of its own.
          socketPath: server.socketPath,
          projectId: project.id,
          worktreeId,
          reviewCommitOid: fixture.reviewCommitOid,
          projectPath: fixture.project,
          worktreePath: fixture.worktree,
          profile: fixture.profile,
          worktrees: fixture.worktrees,
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
    await removePlayground(fixture.root);
  }
} catch (error) {
  if (!shutdown.signal.aborted) {
    process.stderr.write(
      `Playground startup failed. Check that Git is installed.\n${error instanceof Error ? `${error.message.slice(0, 2_000)}\n` : ''}`,
    );
    process.exitCode = 1;
  }
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

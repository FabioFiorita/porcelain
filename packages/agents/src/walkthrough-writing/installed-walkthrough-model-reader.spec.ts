import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigProvider, Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { WalkthroughModelReader } from '@porcelain/walkthroughs/ports';
import { installedWalkthroughModelReaderLayer } from './installed-walkthrough-model-reader.ts';
it('lists signed-in installed writers, includes Opus, and uses each Codex model’s cached effort levels and default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'writer-models-'));
  const state = join(root, 'signed-in');
  await writeFile(state, 'yes');
  const script = `#!${process.execPath}\nconst fs=require('fs');if(process.argv[2]==='login' && process.env.CODEX_HOME!==${JSON.stringify(root)}){process.exit(1)}const signed=fs.readFileSync(${JSON.stringify(state)},'utf8')==='yes';if(process.argv[2]==='auth') console.log(JSON.stringify({loggedIn:signed}));else process.exitCode=signed?0:1;`;
  await writeFile(join(root, 'claude'), script, { mode: 0o700 });
  await writeFile(join(root, 'codex'), script, { mode: 0o700 });
  await writeFile(
    join(root, 'models_cache.json'),
    JSON.stringify({
      models: [
        {
          slug: 'capable-model',
          display_name: 'Capable',
          visibility: 'list',
          default_reasoning_level: 'medium',
          supported_reasoning_levels: [
            { effort: 'medium' },
            { effort: 'high' },
          ],
        },
        { slug: 'hidden-model', display_name: 'Hidden', visibility: 'hide' },
      ],
    }),
  );
  const runtime = ManagedRuntime.make(
    installedWalkthroughModelReaderLayer({
      processDeadlineMs: 2000,
      processGroup: { lingerMs: 20, cleanupMs: 1000, pollMs: 5 },
      codexCacheBytes: 65536,
      claudeOutputBytes: 65536,
      codexOutputBytes: 65536,
      plan: {
        maxGroups: 5,
        maxMessageLength: 100,
        maxPathLength: 100,
        maxPaths: 10,
      },
    }).pipe(
      Layer.provide(NodeServices.layer),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ PATH: root, CODEX_HOME: root }),
        ),
      ),
    ),
  );
  try {
    const reader = await runtime.runPromise(WalkthroughModelReader);
    const listed = await runtime.runPromise(reader.read());
    expect(listed.find((model) => model.model === 'claude-opus-5-5')).toEqual({
      provider: 'claude',
      model: 'claude-opus-5-5',
      label: 'Opus 5.5',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultEffort: 'high',
    });
    expect(listed.filter((model) => model.provider === 'codex')).toEqual([
      {
        provider: 'codex',
        model: 'capable-model',
        label: 'Capable',
        efforts: ['medium', 'high'],
        defaultEffort: 'medium',
      },
    ]);
    await writeFile(state, 'no');
    expect(await runtime.runPromise(reader.read())).toEqual([]);
    await writeFile(state, 'yes');
    await chmod(join(root, 'codex'), 0o600);
    expect(
      (await runtime.runPromise(reader.read())).map((model) => model.provider),
    ).toEqual(['claude', 'claude', 'claude']);
  } finally {
    await runtime.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

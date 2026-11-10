import { ConfigProvider } from 'effect';
import { Effect, Layer, FileSystem, Path } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { WalkthroughModelReader } from '@porcelain/walkthroughs/ports';
import type { AgentLimits } from '../commit-planning/dtos/agent-limits.ts';
import { installedModels } from '../shared/commands/installed-models.ts';
export const installedWalkthroughModelReaderLayer = (limits: AgentLimits) =>
  Layer.effect(
    WalkthroughModelReader,
    Effect.gen(function* () {
      const config = yield* ConfigProvider.ConfigProvider;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return {
        read: Effect.fn('WalkthroughModelReader.read')(() =>
          Effect.all(
            [
              installedModels('claude', limits, true),
              installedModels('codex', limits, true),
            ],
            { concurrency: 2 },
          ).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, config),
            Effect.map((models) =>
              models.flat().filter((model) => model.efforts.length > 0),
            ),
            Effect.provideService(FileSystem.FileSystem, fs),
            Effect.provideService(Path.Path, path),
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              spawner,
            ),
          ),
        ),
      };
    }),
  );

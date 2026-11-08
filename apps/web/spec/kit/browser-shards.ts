import { relative } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import timings from './browser-shards.json' with { type: 'json' };

export function browserShardFiles(
  files: readonly string[],
  count: number,
  weights: {
    readonly fileOverheadMs: number;
    readonly durationsMs: Readonly<Record<string, number>>;
  },
) {
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('Browser shard count must be a positive integer');
  const recorded = Object.values(weights.durationsMs).sort(
    (left, right) => left - right,
  );
  const unrecorded = recorded[Math.floor(recorded.length / 2)] ?? 1;
  const weighted = files
    .map((file) => ({
      file,
      duration:
        (weights.durationsMs[file] ?? unrecorded) + weights.fileOverheadMs,
    }))
    .sort(
      (left, right) =>
        right.duration - left.duration ||
        (left.file < right.file ? -1 : left.file > right.file ? 1 : 0),
    );
  const shards = Array.from({ length: count }, () => ({
    files: [] as string[],
    duration: 0,
  }));
  for (const file of weighted) {
    const lightest = shards.reduce((selected, shard) =>
      shard.duration < selected.duration ? shard : selected,
    );
    lightest.files.push(file.file);
    lightest.duration += file.duration;
  }
  return shards.map((shard) => shard.files);
}

export class BrowserShardSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const { index, count } = this.ctx.config.shard ?? { index: 1, count: 1 };
    const key = (file: TestSpecification) =>
      relative(this.ctx.config.root, file.moduleId).replaceAll('\\', '/');
    const selected = new Set(
      browserShardFiles(files.map(key), count, timings)[index - 1],
    );
    return files.filter((file) => selected.has(key(file)));
  }
}

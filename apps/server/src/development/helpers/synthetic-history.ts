import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { SyntheticShape } from '../profiles.ts';
import {
  createRandom,
  mix,
  nouns,
  type Random,
  renderFile,
  verbs,
} from './synthetic-content.ts';
import type { PlannedFile, SyntheticPlan } from './synthetic-plan.ts';

type Writer = {
  text(value: string): void;
  data(value: string | Buffer): void;
  flush(force?: boolean): Promise<void>;
  end(): Promise<void>;
  abort(): Promise<void>;
};

/** Streams fast-import commands in large chunks and honours pipe backpressure. */
function fastImport(
  repository: string,
  environment: NodeJS.ProcessEnv,
  signal: AbortSignal | undefined,
): Writer {
  const child = spawn(
    'git',
    [
      '-C',
      repository,
      '-c',
      'pack.compression=1',
      'fast-import',
      '--quiet',
      '--done',
      '--active-branches=8',
    ],
    {
      env: environment,
      stdio: ['pipe', 'ignore', 'pipe'],
      ...(signal ? { signal } : {}),
    },
  );
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`git fast-import failed: ${stderr.trim()}`)),
    );
  });
  // Surface the process failure instead of an unhandled EPIPE.
  child.stdin.on('error', () => {});
  let chunks: Buffer[] = [];
  let size = 0;
  const push = (value: Buffer) => {
    chunks.push(value);
    size += value.length;
  };
  const flush = async (force = false) => {
    if (!size || (!force && size < 4 << 20)) return;
    const buffer = Buffer.concat(chunks, size);
    chunks = [];
    size = 0;
    if (!child.stdin.write(buffer))
      await Promise.race([
        once(child.stdin, 'drain'),
        exited.then(() => {
          throw new Error('git fast-import exited early');
        }),
      ]);
  };
  return {
    text: (value) => push(Buffer.from(value, 'latin1')),
    data(value) {
      const buffer =
        typeof value === 'string' ? Buffer.from(value, 'latin1') : value;
      push(Buffer.from(`data ${buffer.length}\n`, 'latin1'));
      push(buffer);
      push(Buffer.from('\n', 'latin1'));
    },
    flush,
    async end() {
      push(Buffer.from('done\n', 'latin1'));
      await flush(true);
      child.stdin.end();
      await exited;
    },
    async abort() {
      child.kill();
      await exited.catch(() => {});
    },
  };
}

/** Weighted sampling over files whose weights change as history evolves. */
class Weights {
  readonly #tree: Float64Array;
  readonly #values: Float64Array;
  total = 0;
  constructor(size: number) {
    this.#tree = new Float64Array(size + 1);
    this.#values = new Float64Array(size);
  }
  set(index: number, value: number) {
    const delta = value - (this.#values[index] ?? 0);
    if (!delta) return;
    this.#values[index] = value;
    this.total += delta;
    for (let at = index + 1; at < this.#tree.length; at += at & -at)
      this.#tree[at] = (this.#tree[at] ?? 0) + delta;
  }
  sample(random: Random) {
    if (this.total <= 1e-9) return -1;
    let target = random.next() * this.total;
    let position = 0;
    for (
      let step = 1 << Math.floor(Math.log2(this.#tree.length));
      step;
      step >>= 1
    ) {
      const next = position + step;
      if (next < this.#tree.length && (this.#tree[next] ?? 0) <= target) {
        position = next;
        target -= this.#tree[next] ?? 0;
      }
    }
    return Math.min(position, this.#values.length - 1);
  }
}

const firstNames = [
  'Ada',
  'Bruno',
  'Chen',
  'Dara',
  'Elif',
  'Farah',
  'Gabriel',
  'Hana',
  'Ines',
  'Jonas',
  'Kofi',
  'Lena',
  'Mateo',
  'Nadia',
  'Omar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sven',
  'Tomas',
  'Uma',
  'Victor',
  'Wen',
  'Yara',
  'Zane',
];
const lastNames = [
  'Almeida',
  'Becker',
  'Costa',
  'Dubois',
  'Eriksen',
  'Fischer',
  'Garcia',
  'Hoffmann',
  'Ito',
  'Jensen',
  'Kowalski',
  'Larsen',
  'Moreau',
  'Nakamura',
  'Okafor',
  'Petrov',
  'Rossi',
  'Santos',
  'Tanaka',
  'Varga',
  'Weber',
  'Yilmaz',
];
const zones = [
  '+0000',
  '+0100',
  '+0200',
  '-0300',
  '-0500',
  '-0800',
  '+0530',
  '+0900',
];
const kinds = ['feat', 'fix', 'refactor', 'chore', 'perf', 'test', 'docs'];

type Author = { name: string; email: string; zone: string };

type HistoryOptions = {
  repository: string;
  environment: NodeJS.ProcessEnv;
  plan: SyntheticPlan;
  shape: SyntheticShape;
  /** Newest synthetic commit time in seconds; the story commits follow it. */
  end: number;
  signal?: AbortSignal | undefined;
};

/** Streams the planned history into a bare repository through git fast-import. */
export async function importSyntheticHistory(options: HistoryOptions) {
  const writer = fastImport(
    options.repository,
    options.environment,
    options.signal,
  );
  try {
    await streamHistory(writer, options);
    await writer.end();
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

async function streamHistory(writer: Writer, options: HistoryOptions) {
  const { plan, shape } = options;
  const random = createRandom(mix(shape.seed, 3));
  const files = plan.files;
  const count = files.length;
  const revision = new Int32Array(count);
  const onMain = new Int32Array(count).fill(-1);
  const renamedOnMain = new Uint8Array(count);
  const weights = new Weights(count);
  const byGroup = new Map<number, number[]>();
  const pathOf = (index: number) => {
    const file = files[index] as PlannedFile;
    return file.renamedFrom && !renamedOnMain[index]
      ? file.renamedFrom
      : file.path;
  };
  const present = (index: number) => {
    const file = files[index] as PlannedFile;
    weights.set(index, file.weight);
    let list = byGroup.get(file.group);
    if (!list) {
      list = [];
      byGroup.set(file.group, list);
    }
    list.push(index);
  };
  const absent = (index: number) => {
    const file = files[index] as PlannedFile;
    weights.set(index, 0);
    const list = byGroup.get(file.group) ?? [];
    list.splice(list.indexOf(index), 1);
    onMain[index] = -1;
  };
  type Event = { at: number; index: number; type: 'add' | 'rename' | 'remove' };
  const events: Event[] = [];
  files.forEach((file, index) => {
    events.push({ at: file.added, index, type: 'add' });
    if (file.renamed !== undefined)
      events.push({ at: file.renamed, index, type: 'rename' });
    if (file.removed !== undefined)
      events.push({ at: file.removed, index, type: 'remove' });
  });
  events.sort((left, right) => left.at - right.at);
  const pending: Event[] = [];
  let cursor = 0;
  const authors: Author[] = Array.from(
    {
      length: Math.max(
        4,
        Math.min(200, Math.round(Math.sqrt(shape.commits) / 3)),
      ),
    },
    (_, index) => {
      const first = firstNames[index % firstNames.length] as string;
      const last = lastNames[
        Math.floor(index / firstNames.length + index) % lastNames.length
      ] as string;
      return {
        name: `${first} ${last}`,
        email:
          `${first}.${last}${index >= firstNames.length ? index : ''}@fieldnotes.example`.toLowerCase(),
        zone: zones[index % zones.length] as string,
      };
    },
  );
  const authorWeights = authors.map((author, index): [Author, number] => [
    author,
    1 / (index + 1) ** 0.9,
  ]);
  const authorTotal = authorWeights.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );
  const pickAuthor = () => {
    let roll = random.next() * authorTotal;
    for (const [author, weight] of authorWeights) {
      roll -= weight;
      if (roll < 0) return author;
    }
    return authors[0] as Author;
  };
  const unmergedBranches = Math.ceil(shape.remoteBranches * 0.6);
  const unmergedAt = Array.from(
    { length: unmergedBranches },
    () => 0.55 + 0.445 * random.next(),
  ).sort((a, b) => a - b);
  const expected = shape.commits + unmergedBranches * 2;
  const start = options.end - shape.historyDays * 86_400;
  const slot = (shape.historyDays * 86_400) / expected;
  let clock = 0;
  const time = () => {
    const value = Math.min(
      options.end,
      Math.round(start + slot * (clock + 0.2 + 0.6 * random.next())),
    );
    clock += 1;
    return value;
  };
  let mark = 0;
  let mainMark = 0;
  let pullRequest = 40 + random.int(80);
  const branchNames = new Set<string>();
  const branchName = () => {
    let name = '';
    while (!name || branchNames.has(name))
      name = `${random.pick(['feature', 'fix', 'chore', 'refactor', 'deps'])}/${random.pick(verbs)}-${random.pick(nouns)}-${random.pick(nouns)}`;
    branchNames.add(name);
    return name;
  };
  const scope = (index: number) => {
    const group = (files[index] as PlannedFile).group;
    return group < 0 ? 'repo' : (plan.packages[group]?.name ?? 'repo');
  };
  const message = (touched: number[], kind: string) => {
    const first = touched[0] ?? -1;
    const area = first >= 0 ? scope(first) : 'repo';
    const subject = `${random.pick(verbs)} ${random.pick(nouns)} ${random.pick(nouns)}s`;
    const line =
      kind === 'add'
        ? random.chance(0.6)
          ? `feat(${area}): add ${random.pick(nouns)} ${random.pick(nouns)}s`
          : `Add ${random.pick(nouns)} support to ${area}`
        : random.chance(0.6)
          ? `${random.pick(kinds)}(${area}): ${subject}`
          : `${subject.charAt(0).toUpperCase()}${subject.slice(1)} in ${area}`;
    return random.chance(0.3)
      ? `${line}\n\n${random.pick(verbs).replace(/^./, (value) => value.toUpperCase())} the ${random.pick(nouns)} flow so ${random.pick(nouns)} ${random.pick(nouns)}s stay consistent.\n`
      : `${line}\n`;
  };
  const header = (
    ref: string,
    text: string,
    parents: number[],
    author = pickAuthor(),
  ) => {
    mark += 1;
    const when = time();
    writer.text(
      `commit ${ref}\nmark :${mark}\nauthor ${author.name} <${author.email}> ${when} ${author.zone}\ncommitter ${author.name} <${author.email}> ${when} ${author.zone}\n`,
    );
    writer.data(text);
    const [from, ...merges] = parents;
    if (from) writer.text(`from :${from}\n`);
    for (const parent of merges) writer.text(`merge :${parent}\n`);
    return mark;
  };
  const render = (index: number, rev: number) =>
    renderFile(files[index] as PlannedFile, rev);
  const mode = (index: number) =>
    (files[index] as PlannedFile).kind === 'sh' ? '100755' : '100644';
  // Revisions count every edit of a file on any branch; content derives from them.
  const bump = (index: number) => {
    revision[index] = (revision[index] ?? 0) + 1;
    return revision[index] as number;
  };
  const modify = (index: number, path = pathOf(index), rev?: number) => {
    const next = rev ?? bump(index);
    writer.text(`M ${mode(index)} inline ${path}\n`);
    writer.data(render(index, next));
    return next;
  };
  const blob = (index: number, rev: number) => {
    mark += 1;
    writer.text(`blob\nmark :${mark}\n`);
    writer.data(render(index, rev));
    return mark;
  };
  const choose = (excluded: ReadonlyMap<number, unknown>, total: number) => {
    const chosen = new Set<number>();
    const first = [0, 1, 2, 3]
      .map(() => weights.sample(random))
      .find((index) => index >= 0 && !excluded.has(index));
    if (first === undefined) return [];
    chosen.add(first);
    const siblings = byGroup.get((files[first] as PlannedFile).group) ?? [];
    for (
      let attempt = 0;
      chosen.size < total && attempt < total * 3;
      attempt += 1
    ) {
      const index =
        random.chance(0.7) && siblings.length
          ? (siblings[random.int(siblings.length)] as number)
          : weights.sample(random);
      if (
        index >= 0 &&
        !excluded.has(index) &&
        (files[index] as PlannedFile).weight > 0
      )
        chosen.add(index);
    }
    return [...chosen];
  };
  const due = (progress: number) => {
    while (cursor < events.length && (events[cursor] as Event).at <= progress)
      pending.push(events[cursor++] as Event);
  };
  const takeAdds = (limit: number) => {
    const taken: number[] = [];
    for (let at = 0; at < pending.length && taken.length < limit; ) {
      const event = pending[at] as Event;
      if (event.type === 'add') {
        taken.push(event.index);
        pending.splice(at, 1);
      } else at += 1;
    }
    return taken;
  };
  const noFeature = new Map<number, unknown>();
  const lockfile = files.findIndex((file) => file.path === plan.lockfile);
  const lockfileAt = Array.from(
    { length: shape.lockfileUpdates },
    (_, index) => (index + 0.5) / shape.lockfileUpdates,
  );
  const refactorAt = Array.from(
    { length: shape.largeCommits },
    (_, index) => (index + 0.3 + 0.4 * random.next()) / shape.largeCommits,
  );
  const commitMain = (
    progress: number,
    last: boolean,
    excluded: ReadonlyMap<number, unknown>,
  ) => {
    due(last ? 2 : progress);
    const changes: string[] = [];
    const touched: number[] = [];
    const lines: (() => void)[] = [];
    let kind = 'modify';
    const adds = new Set(
      takeAdds(
        last || mainMark === 0 ? Number.POSITIVE_INFINITY : 2 + random.int(10),
      ),
    );
    if (excluded.size === 0)
      for (let at = 0; at < pending.length; ) {
        const event = pending[at] as Event;
        if (event.type === 'add' || (!last && changes.length >= 2)) {
          at += 1;
          continue;
        }
        if (adds.has(event.index)) {
          // Added and renamed or removed at once: commit the final state only.
          pending.splice(at, 1);
          if (event.type === 'rename') renamedOnMain[event.index] = 1;
          else adds.delete(event.index);
          continue;
        }
        if (onMain[event.index] === -1) {
          at += 1;
          continue;
        }
        pending.splice(at, 1);
        if (event.type === 'rename') {
          const from = pathOf(event.index);
          lines.push(() => {
            writer.text(
              `R ${from} ${(files[event.index] as PlannedFile).path}\n`,
            );
            renamedOnMain[event.index] = 1;
          });
          changes.push('rename');
        } else {
          lines.push(() => {
            writer.text(`D ${pathOf(event.index)}\n`);
            absent(event.index);
          });
          changes.push('remove');
        }
        touched.push(event.index);
      }
    for (const index of adds) {
      lines.push(() => {
        modify(index, pathOf(index), 0);
        onMain[index] = 0;
        present(index);
      });
      touched.push(index);
      kind = 'add';
    }
    let text = '';
    if (
      lockfile >= 0 &&
      lockfileAt.length &&
      (lockfileAt[0] as number) <= progress &&
      excluded.size === 0
    ) {
      lockfileAt.shift();
      const manifests = [...byGroup.values()]
        .flat()
        .filter((index) => (files[index] as PlannedFile).kind === 'package');
      const bumped = [
        lockfile,
        ...[0, 1, 2]
          .map(() => manifests[random.int(manifests.length)])
          .filter((index): index is number => index !== undefined),
      ];
      for (const index of new Set(bumped))
        lines.push(() => {
          onMain[index] = modify(index);
        });
      text = `chore(deps): update ${random.pick(['dependencies', 'lockfile', 'dev dependencies'])}\n`;
    } else if (
      refactorAt.length &&
      (refactorAt[0] as number) <= progress &&
      excluded.size === 0
    ) {
      refactorAt.shift();
      const size = 50 + random.int(shape.files > 5_000 ? 150 : 30);
      const largest =
        [...byGroup.entries()].sort(
          (left, right) => right[1].length - left[1].length,
        )[0]?.[1] ?? [];
      const pool =
        largest.length >= size ? largest : [...byGroup.values()].flat();
      const picked = new Set<number>();
      for (
        let attempt = 0;
        picked.size < Math.min(size, pool.length) && attempt < size * 4;
        attempt += 1
      ) {
        const index = pool[random.int(pool.length)] as number;
        if (
          (files[index] as PlannedFile).weight > 0 &&
          (files[index] as PlannedFile).bytes < 200_000
        )
          picked.add(index);
      }
      for (const index of picked)
        lines.push(() => {
          onMain[index] = modify(index);
        });
      text = `refactor(${scope([...picked][0] ?? 0)}): ${random.pick(verbs)} ${random.pick(nouns)} ${random.pick(['helpers', 'imports', 'types', 'naming'])} across modules\n`;
    }
    if (!lines.length || (kind === 'add' && random.chance(0.3))) {
      const edits = choose(
        excluded,
        1 + Math.min(7, Math.floor(-Math.log(1 - random.next()) / 0.6)),
      );
      for (const index of edits) {
        lines.push(() => {
          onMain[index] = modify(index);
        });
        touched.push(index);
      }
    }
    const parents = mainMark ? [mainMark] : [];
    const commit = header(
      'refs/heads/main',
      text ||
        (mainMark ? message(touched, kind) : 'Initial workspace import\n'),
      parents,
    );
    for (const line of lines) line();
    writer.text('\n');
    mainMark = commit;
  };
  let merges = 0;
  const features: { name: string; tip: number }[] = [];
  const unmerged: { name: string; tip: number }[] = [];
  const tags: { name: string; tip: number }[] = [];
  let emitted = 0;
  while (emitted < shape.commits) {
    options.signal?.throwIfAborted();
    const progress = emitted / shape.commits;
    const left = shape.commits - emitted;
    if (emitted > 0 && left > 3 && merges < shape.mergeShare * (emitted + 1)) {
      // A pull request: feature commits, main moving on, then a merge commit.
      const name = branchName();
      const overlay = new Map<number, { rev: number; blob: number }>();
      const added = new Set<number>();
      const featureCommits = Math.min(1 + random.int(4), left - 3);
      let tip = mainMark;
      for (let step = 0; step < featureCommits; step += 1) {
        due(progress);
        const adds = takeAdds(random.chance(0.4) ? 1 + random.int(3) : 0);
        const edits = choose(noFeature, 1 + random.int(3)).filter(
          (index) => !added.has(index),
        );
        if (!adds.length && !edits.length) {
          const index = weights.sample(random);
          if (index >= 0) edits.push(index);
        }
        // Blobs get marks so the merge commit can reuse them without rendering again.
        const changes = [
          ...adds.map((index) => {
            added.add(index);
            return { index, rev: 0, blob: blob(index, 0) };
          }),
          ...edits.map((index) => {
            const rev = bump(index);
            return { index, rev, blob: blob(index, rev) };
          }),
        ];
        tip = header(
          'refs/playground/feature',
          message([...adds, ...edits], adds.length ? 'add' : 'modify'),
          [tip],
        );
        for (const change of changes) {
          writer.text(
            `M ${mode(change.index)} :${change.blob} ${pathOf(change.index)}\n`,
          );
          overlay.set(change.index, change);
        }
        writer.text('\n');
      }
      const between = Math.min(random.int(3), left - featureCommits - 2);
      for (let step = 0; step < between; step += 1)
        commitMain(
          (emitted + featureCommits + step) / shape.commits,
          false,
          overlay,
        );
      pullRequest += 1 + random.int(4);
      const merge = header(
        'refs/heads/main',
        random.chance(0.7)
          ? `Merge pull request #${pullRequest} from fieldnotes/${name}\n\n${message([...overlay.keys()], 'modify')}`
          : `Merge branch '${name}'\n`,
        [mainMark, tip],
      );
      for (const [index, change] of overlay) {
        if (added.has(index) || change.rev > (onMain[index] ?? -1))
          writer.text(`M ${mode(index)} :${change.blob} ${pathOf(index)}\n`);
        if (added.has(index)) present(index);
        onMain[index] = Math.max(onMain[index] ?? -1, change.rev);
      }
      writer.text('\n');
      mainMark = merge;
      features.push({ name, tip });
      merges += 1;
      emitted += featureCommits + between + 1;
    } else {
      commitMain(progress, emitted === shape.commits - 1, noFeature);
      emitted += 1;
    }
    while (
      unmergedAt.length &&
      (unmergedAt[0] as number) <= emitted / shape.commits &&
      mainMark
    ) {
      unmergedAt.shift();
      let tip = mainMark;
      for (let step = 1 + random.int(3); step > 0; step -= 1) {
        const edits = choose(noFeature, 1 + random.int(3));
        tip = header('refs/playground/branch', message(edits, 'modify'), [tip]);
        for (const index of edits) modify(index);
        writer.text('\n');
      }
      unmerged.push({ name: branchName(), tip });
    }
    if (emitted >= (tags.length + 1) * 100)
      tags.push({
        name: `v${1 + Math.floor(tags.length / 20)}.${tags.length % 20}.0`,
        tip: mainMark,
      });
    await writer.flush();
  }
  // Merged pull request branches that nobody deleted fill the remaining remote branches.
  const stale = features.slice(Math.floor(features.length * 0.6));
  unmerged.push(
    ...stale.slice(0, Math.max(0, shape.remoteBranches - unmerged.length)),
  );
  for (const branch of unmerged.slice(0, shape.remoteBranches))
    writer.text(`reset refs/heads/${branch.name}\nfrom :${branch.tip}\n\n`);
  for (const tag of tags)
    writer.text(`reset refs/tags/${tag.name}\nfrom :${tag.tip}\n\n`);
}

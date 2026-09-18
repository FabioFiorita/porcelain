import type { SyntheticShape } from '../profiles.ts';
import {
  type ContentSubject,
  createRandom,
  extensions,
  type FileKind,
  mix,
  nouns,
  type Random,
  verbs,
} from './synthetic-content.ts';

export type PlannedFile = ContentSubject & {
  /** Workspace package index, or -1 for workspace root files. */
  group: number;
  /** Relative chance of being edited by a history commit. */
  weight: number;
  /** History progress (0..1) when the file first appears. */
  added: number;
  /** Transient files leave history at this progress. */
  removed?: number;
  /** Files first committed under an older path and renamed later. */
  renamedFrom?: string;
  renamed?: number;
};

export type WorkspacePackage = {
  root: string;
  name: string;
  ignoresBuildOutput: boolean;
};

export type SyntheticPlan = {
  /** Final tree first, then transient files. */
  files: PlannedFile[];
  finalFiles: number;
  packages: WorkspacePackage[];
  lockfile: string;
};

type Group = 'apps' | 'packages' | 'services' | 'tools';

const groupWeights: [Group, number][] = [
  ['apps', 0.08],
  ['packages', 0.64],
  ['services', 0.18],
  ['tools', 0.1],
];
const packageNames: Record<Group, readonly string[]> = {
  apps: ['web', 'admin', 'console', 'storefront', 'docs-site', 'mobile'],
  packages: [
    'core',
    'ui',
    'client',
    'utils',
    'schema',
    'sdk',
    'config',
    'hooks',
    'testing',
    'types',
    'store',
    'api',
  ],
  services: ['api', 'worker', 'service', 'gateway', 'jobs'],
  tools: ['cli', 'codemods', 'scripts', 'generators', 'lint-rules'],
};
const categories = [
  'components',
  'features',
  'hooks',
  'lib',
  'utils',
  'services',
  'models',
  'api',
  'routes',
  'stores',
  'types',
  'schemas',
  'adapters',
  'handlers',
  'middleware',
  'queries',
  'forms',
  'views',
  'layouts',
  'providers',
  'helpers',
  'constants',
  '__tests__',
  'fixtures',
  'generated',
  'internal',
] as const;
const assetFolders = [
  'images',
  'icons',
  'illustrations',
  'screenshots',
  'logos',
  'fonts',
  'avatars',
  'emails',
] as const;
const suffixes = [
  'list',
  'panel',
  'row',
  'card',
  'form',
  'table',
  'dialog',
  'service',
  'store',
  'client',
  'utils',
  'schema',
  'mapper',
  'provider',
  'view',
  'summary',
  'filters',
  'actions',
] as const;
/** Story paths stay at the root; synthetic code never claims them. */
const reservedRoots = [
  'README.md',
  'docs',
  'src',
  'data',
  'tests',
  'server.mjs',
  'app.html',
  'assets',
  'notes.txt',
  '.cache',
];

type Subtree = {
  name: string;
  share: number;
  kinds: [FileKind, number][];
};

const subtrees: Record<Group, Subtree[]> = {
  apps: [
    {
      name: 'src',
      share: 0.86,
      kinds: [
        ['tsx', 34],
        ['ts', 34],
        ['css', 9],
        ['test', 11],
        ['json', 4],
        ['svg', 5],
        ['graphql', 3],
      ],
    },
    { name: 'e2e', share: 0.09, kinds: [['test', 1]] },
    { name: 'docs', share: 0.05, kinds: [['md', 1]] },
  ],
  packages: [
    {
      name: 'src',
      share: 0.86,
      kinds: [
        ['ts', 55],
        ['tsx', 14],
        ['test', 18],
        ['css', 3],
        ['json', 4],
        ['snap', 3],
        ['graphql', 3],
      ],
    },
    {
      name: 'test',
      share: 0.1,
      kinds: [
        ['test', 6],
        ['json', 3],
        ['snap', 1],
      ],
    },
    { name: 'docs', share: 0.04, kinds: [['md', 1]] },
  ],
  services: [
    {
      name: 'src',
      share: 0.8,
      kinds: [
        ['ts', 70],
        ['test', 18],
        ['json', 4],
        ['yaml', 3],
        ['graphql', 5],
      ],
    },
    { name: 'migrations', share: 0.12, kinds: [['sql', 1]] },
    { name: 'config', share: 0.08, kinds: [['yaml', 1]] },
  ],
  tools: [
    {
      name: 'src',
      share: 0.85,
      kinds: [
        ['ts', 50],
        ['js', 30],
        ['sh', 10],
        ['test', 10],
      ],
    },
    {
      name: 'templates',
      share: 0.15,
      kinds: [
        ['html', 1],
        ['md', 1],
      ],
    },
  ],
};

const rootFiles: [string, FileKind][] = [
  ['.gitignore', 'ignore'],
  ['package.json', 'package'],
  ['pnpm-lock.yaml', 'lock'],
  ['pnpm-workspace.yaml', 'yaml'],
  ['tsconfig.base.json', 'tsconfig'],
  ['.github/workflows/ci.yml', 'workflow'],
  ['.github/workflows/release.yml', 'workflow'],
  ['scripts/release.mjs', 'js'],
  ['.github/workflows/nightly.yml', 'workflow'],
  ['scripts/check-environment.sh', 'sh'],
];

function weighted<T>(random: Random, entries: readonly [T, number][]) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return (entries.at(-1) as [T, number])[0];
}

const kebab = (random: Random) =>
  random.chance(0.5)
    ? `${random.pick(nouns)}-${random.pick(suffixes)}`
    : `${random.pick(verbs)}-${random.pick(nouns)}`;
const pascal = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

function fileName(random: Random, kind: FileKind, order: number) {
  switch (kind) {
    case 'tsx':
      return `${pascal(`${random.pick(nouns)}-${random.pick(suffixes)}`)}.tsx`;
    case 'sql':
      return `${String(order + 1).padStart(4, '0')}_${random.pick(verbs)}_${random.pick(nouns)}s.sql`;
    case 'snap':
      return `${kebab(random)}.test.ts.snap`;
    case 'png':
      return `${random.pick(nouns)}-${random.pick(['hero', 'empty', 'icon', 'preview', 'banner', 'avatar'])}${random.chance(0.3) ? '@2x' : ''}.png`;
    case 'woff2':
      return `${random.pick(['inter', 'plex', 'source'])}-${random.pick(['regular', 'medium', 'semibold', 'bold'])}.woff2`;
    case 'css':
      return `${kebab(random)}.module.css`;
    default:
      return `${random.chance(0.25) ? `use-${random.pick(nouns)}` : kebab(random)}${extensions[kind]}`;
  }
}

type Request = {
  base: string;
  levels: number;
  kind: FileKind;
  bytes: number;
  group: number;
  added: number;
  assets: boolean;
};

type Node = { names: Set<string>; children: { name: string; count: number }[] };

function ancestors(path: string, into: Set<string>) {
  for (let slash = path.lastIndexOf('/'); slash > 0; ) {
    const directory = path.slice(0, slash);
    if (into.has(directory)) return;
    into.add(directory);
    slash = directory.lastIndexOf('/');
  }
}

function place(
  requests: Request[],
  alpha: number,
  seed: number,
  existing: ReadonlySet<string>,
) {
  const random = createRandom(seed);
  const nodes = new Map<string, Node>();
  const directories = new Set(existing);
  const node = (path: string) => {
    let value = nodes.get(path);
    if (!value) {
      value = { names: new Set(), children: [] };
      nodes.set(path, value);
    }
    return value;
  };
  const paths = requests.map((request) => {
    let path = request.base;
    for (let level = 0; level < request.levels; level += 1) {
      const current = node(path);
      let total = 0;
      for (const child of current.children) total += child.count;
      let chosen: { name: string; count: number } | undefined;
      if (current.children.length && random.next() >= alpha / (total + alpha)) {
        let roll = random.next() * total;
        for (const child of current.children) {
          roll -= child.count;
          if (roll < 0) {
            chosen = child;
            break;
          }
        }
      }
      if (!chosen) {
        const vocabulary = request.assets
          ? assetFolders
          : level % 2
            ? nouns
            : categories;
        let name: string = random.pick(vocabulary);
        for (let attempt = 0; current.names.has(name); attempt += 1)
          name =
            attempt < 8
              ? random.pick(vocabulary)
              : `${random.pick(vocabulary)}-${attempt}`;
        current.names.add(name);
        chosen = { name, count: 0 };
        current.children.push(chosen);
      }
      chosen.count += 1;
      path = `${path}/${chosen.name}`;
    }
    ancestors(`${path}/file`, directories);
    return path;
  });
  return { paths, directories: directories.size };
}

function sizeSampler(random: Random, shape: SyntheticShape) {
  const sigma = Math.log(shape.p90FileBytes / shape.medianFileBytes) / 1.2816;
  return (scale = 1) =>
    Math.round(
      Math.min(
        99_000,
        Math.max(
          40,
          shape.medianFileBytes * scale * Math.exp(sigma * random.normal()),
        ),
      ),
    );
}

export function planRepository(shape: SyntheticShape): SyntheticPlan {
  const random = createRandom(mix(shape.seed, 1));
  const size = sizeSampler(random, shape);
  const files: PlannedFile[] = [];
  const used = new Set(reservedRoots);
  const push = (
    path: string,
    kind: FileKind,
    bytes: number,
    group: number,
    added: number,
  ) => {
    used.add(path);
    files.push({
      path,
      kind,
      bytes,
      group,
      added,
      seed: mix(shape.seed, files.length, 101),
      weight: Math.exp(1.2 * random.normal()),
    });
  };
  const rootCount = Math.min(
    rootFiles.length,
    Math.max(3, Math.floor(shape.files * 0.05)),
  );
  for (const [path, kind] of rootFiles.slice(0, rootCount))
    push(
      path,
      kind,
      kind === 'lock' ? shape.lockfileBytes : size(0.5),
      -1,
      path.startsWith('scripts/') ? random.next() * 0.6 : 0,
    );
  const binaries = Math.min(
    shape.binaryFiles,
    Math.floor((shape.files - rootCount) / 4),
  );
  const textBudget = shape.files - rootCount - binaries;
  const packageCount = Math.max(
    1,
    Math.min(shape.packages - 1, Math.floor(textBudget / 4)),
  );
  const packages: (WorkspacePackage & { group: Group; intro: number })[] = [];
  const names = new Set<string>();
  for (let index = 0; index < packageCount; index += 1) {
    const group = index === 0 ? 'apps' : weighted(random, groupWeights);
    let name = '';
    for (let attempt = 0; !name || names.has(`${group}/${name}`); attempt += 1)
      name =
        group === 'apps' && attempt < 4
          ? random.pick(packageNames.apps)
          : `${random.pick(nouns)}-${random.pick(packageNames[group])}${attempt > 20 ? `-${attempt}` : ''}`;
    names.add(`${group}/${name}`);
    packages.push({
      root: `${group}/${name}`,
      name,
      group,
      ignoresBuildOutput: group === 'apps' || random.chance(0.7),
      intro:
        index < Math.max(1, Math.ceil(packageCount * 0.15))
          ? 0
          : random.next() * 0.85,
    });
  }
  const weights = packages.map(
    (entry) =>
      Math.exp(0.9 * random.normal()) * (entry.group === 'apps' ? 3 : 1),
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let remaining = textBudget - packageCount * 4;
  const budgets = packages.map((_, index) => {
    const extra = Math.min(
      remaining,
      Math.floor(
        ((weights[index] ?? 0) / totalWeight) * (textBudget - packageCount * 4),
      ),
    );
    remaining -= extra;
    return 4 + extra;
  });
  for (let index = 0; remaining > 0; index = (index + 1) % packageCount) {
    budgets[index] = (budgets[index] ?? 4) + 1;
    remaining -= 1;
  }
  const requests: Request[] = [];
  const later = (intro: number) =>
    intro + (0.97 - intro) * random.next() ** 1.4;
  packages.forEach((entry, group) => {
    let budget = budgets[group] ?? 4;
    const fixed: [string, FileKind, number][] = [
      ['package.json', 'package', 500],
      ['README.md', 'md', size(0.8)],
      ['tsconfig.json', 'tsconfig', 200],
    ];
    if (entry.ignoresBuildOutput) fixed.push(['.gitignore', 'ignore', 30]);
    if (random.chance(0.3)) fixed.push(['CHANGELOG.md', 'md', size(2)]);
    if (random.chance(0.4)) fixed.push(['vitest.config.ts', 'ts', 300]);
    for (const [file, kind, bytes] of fixed.slice(0, budget - 1)) {
      push(`${entry.root}/${file}`, kind, bytes, group, entry.intro);
      budget -= 1;
    }
    push(`${entry.root}/src/index.ts`, 'ts', size(0.3), group, entry.intro);
    budget -= 1;
    const mean = shape.medianDepth - 3;
    for (let index = 0; index < budget; index += 1) {
      const subtree = weighted(
        random,
        subtrees[entry.group].map((value): [Subtree, number] => [
          value,
          value.share,
        ]),
      );
      const kind = weighted(random, subtree.kinds);
      let levels = Math.round(mean + 1.1 * random.normal());
      if (random.chance(0.03)) levels += 2 + random.int(4);
      requests.push({
        base: `${entry.root}/${subtree.name}`,
        levels: Math.max(0, Math.min(shape.maxDepth - 3, levels)),
        kind,
        bytes: size(kind === 'css' || kind === 'svg' ? 0.6 : 1),
        group,
        added: later(entry.intro),
        assets: false,
      });
    }
  });
  const assetWeights = packages.map((entry, index): [number, number] => [
    index,
    entry.group === 'apps' ? 6 : 1,
  ]);
  for (let index = 0; index < binaries; index += 1) {
    const group = weighted(random, assetWeights);
    const entry = packages[group] as (typeof packages)[number];
    const kind: FileKind = random.chance(0.92) ? 'png' : 'woff2';
    requests.push({
      base: `${entry.root}/${entry.group === 'apps' ? 'public' : 'assets'}`,
      levels: random.int(3),
      kind,
      bytes: Math.round(
        Math.min(
          900_000,
          Math.max(
            200,
            (kind === 'png' ? 9_000 : 30_000) * Math.exp(1.2 * random.normal()),
          ),
        ),
      ),
      group,
      added: later(entry.intro),
      assets: true,
    });
  }
  // Tune directory branching until the planned tree has the target directory count.
  const placementSeed = mix(shape.seed, 7);
  const existing = new Set<string>();
  for (const file of files) ancestors(file.path, existing);
  let low = 0.01;
  let high = 64;
  let best = place(requests, 1, placementSeed, existing);
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const alpha = Math.sqrt(low * high);
    const candidate = place(requests, alpha, placementSeed, existing);
    if (
      Math.abs(candidate.directories - shape.directories) <
      Math.abs(best.directories - shape.directories)
    )
      best = candidate;
    if (candidate.directories < shape.directories) low = alpha;
    else high = alpha;
  }
  const directoryNames = new Map<string, Set<string>>();
  const namesIn = (directory: string) => {
    let value = directoryNames.get(directory);
    if (!value) {
      value = new Set();
      directoryNames.set(directory, value);
    }
    return value;
  };
  for (const file of files) {
    const slash = file.path.lastIndexOf('/');
    namesIn(file.path.slice(0, slash)).add(file.path.slice(slash + 1));
  }
  const uniqueName = (directory: string, kind: FileKind) => {
    const taken = namesIn(directory);
    let name = fileName(random, kind, taken.size);
    for (
      let attempt = 2;
      taken.has(name) || used.has(`${directory}/${name}`);
      attempt += 1
    ) {
      name = fileName(random, kind, taken.size);
      if (attempt > 6) name = name.replace(/^([^.]+)/, `$1-${attempt}`);
    }
    taken.add(name);
    return name;
  };
  requests.forEach((request, index) => {
    const directory = best.paths[index] as string;
    push(
      `${directory}/${uniqueName(directory, request.kind)}`,
      request.kind,
      request.bytes,
      request.group,
      request.added,
    );
  });
  // Rare large text files: generated code, fixtures, snapshots and seed data.
  const candidates = files.filter(
    (file) =>
      file.group >= 0 &&
      ['json', 'snap', 'sql', 'ts', 'md', 'graphql'].includes(file.kind) &&
      !/\/(package|tsconfig)\.json$|\/index\.ts$/.test(file.path),
  );
  const take = () => candidates.splice(random.int(candidates.length), 1)[0];
  for (let index = 0; index < shape.multiMegabyteFiles; index += 1) {
    const file = take();
    if (!file) break;
    file.bytes =
      index === 0
        ? shape.maxFileBytes
        : Math.round(
            Math.exp(
              Math.log(1_100_000) +
                random.next() * Math.log(shape.maxFileBytes / 1_100_000),
            ),
          );
  }
  for (let index = 0; index < shape.largeFiles; index += 1) {
    const file = take();
    if (!file) break;
    file.bytes = Math.round(
      Math.exp(Math.log(100_000) + random.next() * Math.log(10)),
    );
  }
  const finalFiles = files.length;
  // Renames and removals keep realistic churn in history without changing the final tree.
  const movable = files.filter(
    (file) => file.group >= 0 && /\/(src|test|migrations)\//.test(file.path),
  );
  const churn = Math.round(finalFiles * 0.02);
  for (let index = 0; index < churn && movable.length; index += 1) {
    const file = movable.splice(
      random.int(movable.length),
      1,
    )[0] as PlannedFile;
    const slash = file.path.lastIndexOf('/');
    const directory = file.path.slice(0, slash);
    const parent = directory.slice(0, directory.lastIndexOf('/'));
    const moved = `${parent}/${file.path.slice(slash + 1)}`;
    const from =
      /\/(src|test|migrations)\//.test(`${moved}`) &&
      random.chance(0.5) &&
      !used.has(moved)
        ? moved
        : `${directory}/${uniqueName(directory, file.kind)}`;
    used.add(from);
    namesIn(from.slice(0, from.lastIndexOf('/'))).add(
      from.slice(from.lastIndexOf('/') + 1),
    );
    file.renamedFrom = from;
    file.renamed = file.added + (0.98 - file.added) * random.next();
  }
  const templates = files.filter((file) => file.group >= 0);
  for (let index = 0; index < churn && templates.length; index += 1) {
    const template = random.pick(templates);
    const directory = template.path.slice(0, template.path.lastIndexOf('/'));
    const added = template.added + (0.9 - template.added) * random.next();
    const kind = ['package', 'tsconfig', 'ignore'].includes(template.kind)
      ? 'md'
      : template.kind;
    push(
      `${directory}/${uniqueName(directory, kind)}`,
      kind,
      Math.min(template.bytes, 99_000),
      template.group,
      Math.max(0, added),
    );
    (files.at(-1) as PlannedFile).removed =
      added + (0.97 - added) * random.next();
  }
  for (const file of files) {
    if (file.kind === 'ignore' || file.kind === 'lock') file.weight = 0;
    else if (file.bytes > 15_000) file.weight *= 15_000 / file.bytes;
  }
  return {
    files,
    finalFiles,
    packages: packages.map(({ root, name, ignoresBuildOutput }) => ({
      root,
      name,
      ignoresBuildOutput,
    })),
    lockfile: 'pnpm-lock.yaml',
  };
}

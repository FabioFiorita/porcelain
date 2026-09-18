import { crc32, deflateSync } from 'node:zlib';

export type Random = {
  next(): number;
  int(limit: number): number;
  pick<T>(values: readonly T[]): T;
  chance(probability: number): boolean;
  normal(): number;
};

export function mix(...values: number[]) {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash = Math.imul(hash ^ (value >>> 0), 0x01000193);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x2c1b3c6d);
    hash ^= hash >>> 12;
  }
  return hash >>> 0;
}

/** Mulberry32: tiny, fast and deterministic across platforms. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const int = (limit: number) => Math.floor(next() * limit);
  return {
    next,
    int,
    pick: <T>(values: readonly T[]) => values[int(values.length)] as T,
    chance: (probability) => next() < probability,
    normal: () =>
      Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
  };
}

const textKinds = [
  'ts',
  'tsx',
  'test',
  'js',
  'json',
  'package',
  'tsconfig',
  'md',
  'css',
  'yaml',
  'workflow',
  'sql',
  'snap',
  'svg',
  'graphql',
  'sh',
  'html',
  'ignore',
  'lock',
] as const;
const binaryKinds = ['png', 'woff2'] as const;
export type TextKind = (typeof textKinds)[number];
export type BinaryKind = (typeof binaryKinds)[number];
export type FileKind = TextKind | BinaryKind;

export function isBinaryKind(kind: FileKind): kind is BinaryKind {
  return (binaryKinds as readonly string[]).includes(kind);
}

export const extensions: Record<FileKind, string> = {
  ts: '.ts',
  tsx: '.tsx',
  test: '.test.ts',
  js: '.mjs',
  json: '.json',
  package: '.json',
  tsconfig: '.json',
  md: '.md',
  css: '.css',
  yaml: '.yaml',
  workflow: '.yml',
  sql: '.sql',
  snap: '.ts.snap',
  svg: '.svg',
  graphql: '.graphql',
  sh: '.sh',
  html: '.html',
  ignore: '',
  lock: '.yaml',
  png: '.png',
  woff2: '.woff2',
};

export const nouns = [
  'account',
  'activity',
  'address',
  'alert',
  'approval',
  'asset',
  'audit',
  'badge',
  'balance',
  'batch',
  'billing',
  'budget',
  'cache',
  'calendar',
  'campaign',
  'card',
  'cart',
  'catalog',
  'channel',
  'checkout',
  'client',
  'comment',
  'contract',
  'coupon',
  'credit',
  'currency',
  'customer',
  'dashboard',
  'dataset',
  'delivery',
  'device',
  'discount',
  'document',
  'draft',
  'event',
  'export',
  'feature',
  'feed',
  'filter',
  'folder',
  'forecast',
  'gateway',
  'invoice',
  'job',
  'label',
  'ledger',
  'license',
  'locale',
  'member',
  'message',
  'metric',
  'note',
  'notice',
  'order',
  'organization',
  'payment',
  'payout',
  'permission',
  'plan',
  'policy',
  'preview',
  'price',
  'profile',
  'project',
  'queue',
  'quota',
  'receipt',
  'record',
  'refund',
  'region',
  'release',
  'report',
  'request',
  'review',
  'role',
  'route',
  'schedule',
  'search',
  'segment',
  'session',
  'setting',
  'shipment',
  'signal',
  'snapshot',
  'source',
  'status',
  'subscription',
  'summary',
  'task',
  'team',
  'template',
  'tenant',
  'ticket',
  'timeline',
  'token',
  'transfer',
  'upload',
  'usage',
  'user',
  'vendor',
  'webhook',
  'workflow',
  'workspace',
] as const;

export const verbs = [
  'apply',
  'build',
  'calculate',
  'check',
  'collect',
  'compare',
  'create',
  'decode',
  'encode',
  'ensure',
  'extract',
  'fetch',
  'filter',
  'format',
  'group',
  'handle',
  'load',
  'map',
  'merge',
  'normalize',
  'parse',
  'prepare',
  'publish',
  'read',
  'record',
  'refresh',
  'remove',
  'render',
  'resolve',
  'retry',
  'save',
  'schedule',
  'select',
  'serialize',
  'sort',
  'sync',
  'track',
  'update',
  'validate',
  'watch',
] as const;

const adjectives = [
  'active',
  'archived',
  'cached',
  'current',
  'default',
  'draft',
  'empty',
  'expired',
  'external',
  'failed',
  'hidden',
  'initial',
  'latest',
  'local',
  'missing',
  'nested',
  'optional',
  'paid',
  'partial',
  'pending',
  'primary',
  'private',
  'public',
  'recent',
  'remote',
  'scheduled',
  'shared',
  'stale',
  'visible',
] as const;

const types = [
  'string',
  'number',
  'boolean',
  'Date',
  'string[]',
  'Record<string, string>',
  'number | null',
  'string | undefined',
] as const;

const cssProperties = [
  ['display', ['flex', 'grid', 'block', 'inline-flex', 'none']],
  ['gap', ['4px', '8px', '12px', '16px', 'var(--space-2)']],
  ['padding', ['0', '4px 8px', '8px 12px', 'var(--space-3)']],
  ['color', ['var(--fg)', 'var(--muted)', '#1f2933', '#52606d']],
  ['background', ['transparent', 'var(--surface)', '#f5f7fa']],
  ['border-radius', ['4px', '6px', '999px', 'var(--radius)']],
  ['font-size', ['12px', '14px', '0.875rem', '1rem']],
  ['align-items', ['center', 'flex-start', 'stretch']],
  ['justify-content', ['space-between', 'flex-end', 'center']],
] as const;

export const dependencyNames = [
  'ajv',
  'chalk',
  'clsx',
  'commander',
  'date-fns',
  'debug',
  'dotenv',
  'esbuild',
  'fast-glob',
  'immer',
  'kysely',
  'lru-cache',
  'mime',
  'nanoid',
  'p-limit',
  'picomatch',
  'pino',
  'postcss',
  'prettier',
  'react',
  'react-dom',
  'semver',
  'tslib',
  'typescript',
  'undici',
  'uuid',
  'vite',
  'vitest',
  'ws',
  'yaml',
  'zod',
] as const;

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
const hex = (random: Random, length: number) => {
  let value = '';
  while (value.length < length)
    value += Math.floor(random.next() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return value.slice(0, length);
};
const base64Alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64 = (random: Random, length: number) => {
  let value = '';
  for (let index = 0; index < length; index += 1)
    value += base64Alphabet[random.int(64)];
  return value;
};
const version = (random: Random) =>
  `${random.int(12)}.${random.int(30)}.${random.int(20)}`;

type Context = { stem: string; name: string };

function identifier(random: Random) {
  return `${random.pick(verbs)}${capitalize(random.pick(nouns))}${capitalize(random.pick(nouns))}`;
}

function sentence(random: Random, words: number) {
  const parts: string[] = [];
  for (let index = 0; index < words; index += 1)
    parts.push(
      random.chance(0.3) ? random.pick(adjectives) : random.pick(nouns),
    );
  return `${capitalize(parts.join(' '))}.`;
}

function tsBlock(random: Random, context: Context) {
  const noun = capitalize(random.pick(nouns));
  const other = capitalize(random.pick(nouns));
  switch (random.int(5)) {
    case 0: {
      let fields = '';
      const count = 2 + random.int(6);
      for (let index = 0; index < count; index += 1)
        fields += `  ${random.pick(nouns)}${capitalize(random.pick(adjectives))}${random.chance(0.3) ? '?' : ''}: ${random.pick(types)};\n`;
      return `export interface ${noun}${other} {\n  id: string;\n${fields}}\n`;
    }
    case 1: {
      const name = identifier(random);
      return `export function ${name}(input: ${noun}${other}Input): ${random.pick(types)} {\n  const ${random.pick(nouns)}Count = input.items?.length ?? ${random.int(100)};\n  if (!input.${random.pick(nouns)}) {\n    return ${random.chance(0.5) ? 'null' : `'${random.pick(adjectives)}'`} as never;\n  }\n  return input.items.filter((item) => item.${random.pick(nouns)} !== '${random.pick(adjectives)}').length as never;\n}\n`;
    }
    case 2: {
      let entries = '';
      const count = 2 + random.int(7);
      for (let index = 0; index < count; index += 1)
        entries += `  ${random.pick(nouns)}${capitalize(random.pick(adjectives))}: '${random.pick(nouns)}-${hex(random, 4)}',\n`;
      return `export const ${random.pick(nouns)}${noun}Keys = {\n${entries}} as const;\n`;
    }
    case 3:
      return `export const ${identifier(random)} = async (client: ${context.name}Client, id: string) => {\n  const response = await client.get(\`/${random.pick(nouns)}s/\${id}\`);\n  if (!response.ok) throw new Error('Unable to ${random.pick(verbs)} ${random.pick(nouns)} ${random.int(1000)}');\n  return ${random.pick(nouns)}Schema.parse(await response.json());\n};\n`;
    default:
      return `export class ${noun}${other}Store {\n  readonly #items = new Map<string, ${noun}>();\n\n  ${random.pick(verbs)}(item: ${noun}) {\n    this.#items.set(item.id, { ...item, ${random.pick(nouns)}: ${random.int(500)} });\n    return this.#items.size;\n  }\n\n  ${random.pick(verbs)}${other}(id: string) {\n    return this.#items.get(id) ?? null;\n  }\n}\n`;
  }
}

function tsxBlock(random: Random, context: Context) {
  const component = `${capitalize(random.pick(nouns))}${capitalize(random.pick(['list', 'panel', 'row', 'card', 'header', 'dialog', 'form', 'badge']))}`;
  const prop = random.pick(nouns);
  return `export function ${component}({ ${prop}, on${capitalize(random.pick(verbs))} }: ${component}Props) {\n  const [${random.pick(adjectives)}, set${capitalize(random.pick(adjectives))}] = useState(${random.chance(0.5) ? 'false' : random.int(10)});\n  return (\n    <section className="${context.stem}__${prop}">\n      <h3>{${prop}.${random.pick(nouns)}}</h3>\n      <p>${sentence(random, 5)}</p>\n    </section>\n  );\n}\n`;
}

function testBlock(random: Random, context: Context) {
  const cases = 1 + random.int(3);
  let body = '';
  for (let index = 0; index < cases; index += 1)
    body += `  it('${random.pick(verbs)}s ${random.pick(adjectives)} ${random.pick(nouns)}s', () => {\n    const result = ${identifier(random)}({ items: [], ${random.pick(nouns)}: '${hex(random, 6)}' });\n    expect(result).toEqual(${random.chance(0.5) ? random.int(100) : `'${random.pick(adjectives)}'`});\n  });\n`;
  return `describe('${context.name} ${random.pick(nouns)}', () => {\n${body}});\n`;
}

function jsonBlock(random: Random) {
  return `  { "id": "${random.pick(nouns)}_${hex(random, 10)}", "status": "${random.pick(adjectives)}", "amount": ${random.int(100000)}, "owner": "${random.pick(nouns)}-${random.int(900)}", "tags": ["${random.pick(nouns)}", "${random.pick(adjectives)}"], "updatedAt": "20${20 + random.int(6)}-0${1 + random.int(9)}-1${random.int(9)}T0${random.int(9)}:1${random.int(9)}:00Z" }`;
}

function mdBlock(random: Random) {
  let items = '';
  const count = 1 + random.int(4);
  for (let index = 0; index < count; index += 1)
    items += `- ${sentence(random, 4 + random.int(6))}\n`;
  return `## ${capitalize(random.pick(verbs))} ${random.pick(nouns)}s\n\n${sentence(random, 10 + random.int(20))} ${sentence(random, 8 + random.int(12))}\n\n${items}\n`;
}

function cssBlock(random: Random, context: Context) {
  let rules = '';
  const count = 2 + random.int(5);
  for (let index = 0; index < count; index += 1) {
    const [property, values] = random.pick(cssProperties);
    rules += `  ${property}: ${random.pick(values)};\n`;
  }
  return `.${context.stem}__${random.pick(nouns)}${random.chance(0.3) ? `--${random.pick(adjectives)}` : ''} {\n${rules}}\n\n`;
}

function yamlBlock(random: Random) {
  return `${random.pick(nouns)}_${random.pick(nouns)}:\n  enabled: ${random.chance(0.5)}\n  retries: ${random.int(8)}\n  timeout: ${random.int(60)}s\n  targets:\n    - ${random.pick(nouns)}-${random.int(40)}\n    - ${random.pick(nouns)}-${random.int(40)}\n`;
}

function workflowBlock(random: Random) {
  const job = `${random.pick(verbs)}-${random.pick(nouns)}`;
  return `  ${job}:\n    runs-on: ubuntu-latest\n    timeout-minutes: ${5 + random.int(25)}\n    steps:\n      - uses: actions/checkout@v4\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm --filter ./${random.pick(['apps', 'packages', 'services'])}/** ${random.pick(['test', 'lint', 'build', 'typecheck'])}\n`;
}

function sqlBlock(random: Random) {
  const table = `${random.pick(nouns)}_${random.pick(nouns)}s`;
  switch (random.int(3)) {
    case 0:
      return `CREATE TABLE ${table} (\n  id uuid PRIMARY KEY,\n  ${random.pick(nouns)}_id uuid NOT NULL,\n  status text NOT NULL DEFAULT '${random.pick(adjectives)}',\n  amount integer,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\n`;
    case 1:
      return `CREATE INDEX ${table}_${random.pick(nouns)}_idx ON ${table} (${random.pick(nouns)}_id, created_at);\n\n`;
    default:
      return `INSERT INTO ${table} (id, status, amount) VALUES ('${hex(random, 8)}-${hex(random, 4)}-4${hex(random, 3)}-a${hex(random, 3)}-${hex(random, 12)}', '${random.pick(adjectives)}', ${random.int(90000)});\n`;
  }
}

function snapBlock(random: Random, context: Context) {
  return `exports[\`${context.name} > ${random.pick(verbs)}s ${random.pick(nouns)} ${random.int(99)}\`] = \`\n<section class="${context.stem}">\n  <h3>${sentence(random, 3)}</h3>\n  <span data-state="${random.pick(adjectives)}">${random.int(10000)}</span>\n</section>\n\`;\n\n`;
}

function svgBlock(random: Random) {
  return `  <path d="M${random.int(24)} ${random.int(24)}L${random.int(24)} ${random.int(24)}C${random.int(24)} ${random.int(24)} ${random.int(24)} ${random.int(24)} ${random.int(24)} ${random.int(24)}Z" fill="currentColor"/>\n`;
}

function graphqlBlock(random: Random) {
  const type = capitalize(random.pick(nouns));
  return `type ${type}${capitalize(random.pick(nouns))} {\n  id: ID!\n  ${random.pick(nouns)}: String\n  ${random.pick(nouns)}Count: Int!\n  ${random.pick(adjectives)}: Boolean\n}\n\n`;
}

function shBlock(random: Random) {
  return `echo "${random.pick(verbs)} ${random.pick(nouns)}s"\npnpm --filter "${random.pick(nouns)}-*" run ${random.pick(['build', 'test', 'lint'])}\n`;
}

function htmlBlock(random: Random) {
  return `    <section class="${random.pick(nouns)}">\n      <h2>${sentence(random, 3)}</h2>\n      <p>${sentence(random, 12)}</p>\n    </section>\n`;
}

function lockBlock(random: Random) {
  const name = random.chance(0.3)
    ? `@${random.pick(nouns)}/${random.pick(dependencyNames)}-${random.pick(nouns)}`
    : `${random.pick(dependencyNames)}-${random.pick(nouns)}`;
  return `  ${name}@${version(random)}:\n    resolution: {integrity: sha512-${base64(random, 86)}==}\n    engines: {node: '>=${16 + random.int(8)}'}\n    dependencies:\n      ${random.pick(dependencyNames)}: ${version(random)}\n      ${random.pick(dependencyNames)}: ${version(random)}\n\n`;
}

type Layout = {
  header(context: Context, random: Random): string;
  block(random: Random, context: Context): string;
  separator?: string;
  footer?: string;
  blockBytes: number;
};

const layouts: Record<
  Exclude<TextKind, 'package' | 'tsconfig' | 'ignore'>,
  Layout
> = {
  ts: {
    header: (context, random) =>
      `import { ${random.pick(nouns)}Schema } from './schemas';\nimport type { ${context.name}Client } from '../client';\n\n`,
    block: tsBlock,
    blockBytes: 238,
  },
  tsx: {
    header: () =>
      `import { useState } from 'react';\nimport type { ReactNode } from 'react';\n\n`,
    block: tsxBlock,
    blockBytes: 277,
  },
  test: {
    header: (context) =>
      `import { describe, expect, it } from 'vitest';\nimport * as ${context.stem.replaceAll(/[^a-z]/g, '')} from './index';\n\n`,
    block: testBlock,
    blockBytes: 353,
  },
  js: {
    header: () =>
      `import { readFile } from 'node:fs/promises';\nimport { join } from 'node:path';\n\n`,
    block: tsBlock,
    blockBytes: 238,
  },
  json: {
    header: () => '[\n',
    block: jsonBlock,
    separator: ',\n',
    footer: '\n]\n',
    blockBytes: 162,
  },
  md: {
    header: (context) => `# ${capitalize(context.name)}\n\n`,
    block: mdBlock,
    blockBytes: 395,
  },
  css: { header: () => '', block: cssBlock, blockBytes: 117 },
  yaml: { header: () => '', block: yamlBlock, blockBytes: 104 },
  workflow: {
    header: (context) =>
      `name: ${context.name}\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n`,
    block: workflowBlock,
    blockBytes: 203,
  },
  sql: { header: () => '', block: sqlBlock, blockBytes: 132 },
  snap: {
    header: () => '// Vitest Snapshot v1\n\n',
    block: snapBlock,
    blockBytes: 166,
  },
  svg: {
    header: () =>
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n',
    block: svgBlock,
    footer: '</svg>\n',
    blockBytes: 62,
  },
  graphql: { header: () => '', block: graphqlBlock, blockBytes: 90 },
  sh: {
    header: () => '#!/usr/bin/env bash\nset -euo pipefail\n\n',
    block: shBlock,
    blockBytes: 58,
  },
  html: {
    header: (context) =>
      `<!doctype html>\n<html lang="en">\n  <head><title>${context.name}</title></head>\n  <body>\n`,
    block: htmlBlock,
    footer: '  </body>\n</html>\n',
    blockBytes: 186,
  },
  lock: {
    header: () =>
      "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\npackages:\n\n",
    block: lockBlock,
    blockBytes: 240,
  },
};

export type ContentSubject = {
  path: string;
  kind: FileKind;
  bytes: number;
  seed: number;
};

function contextOf(path: string): Context {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const stem =
    file
      .replace(/\..*$/, '')
      .replaceAll(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase() || 'module';
  const name = stem
    .split('-')
    .map((part, index) => (index ? capitalize(part) : part))
    .join('');
  return { stem, name: capitalize(name) };
}

/** A fresh block of kind-appropriate lines, used for working-tree edits. */
export function renderBlock(kind: TextKind, random: Random, path: string) {
  const context = contextOf(path);
  if (kind === 'package' || kind === 'tsconfig') return jsonBlock(random);
  if (kind === 'ignore') return `${random.pick(nouns)}-output/\n`;
  return layouts[kind].block(random, context);
}

function fixedText(subject: ContentSubject, revision: number) {
  if (subject.kind === 'package') return renderPackage(subject, revision);
  if (subject.kind === 'tsconfig')
    return subject.path.includes('/')
      ? `{\n  "extends": "${'../'.repeat(subject.path.split('/').length - 1)}tsconfig.base.json",\n  "compilerOptions": { "outDir": "dist", "rootDir": "src" },\n  "include": ["src"]\n}\n`
      : '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "NodeNext",\n    "strict": true,\n    "skipLibCheck": true\n  }\n}\n';
  if (subject.kind === 'ignore') return ignoreRules(subject.path);
  if (subject.path === 'pnpm-workspace.yaml')
    return "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'services/*'\n  - 'tools/*'\n";
  return undefined;
}

/**
 * Text is a header plus blocks. Each revision touches a few blocks, appends one
 * or rewrites a larger share, so consecutive revisions produce reviewable diffs.
 */
export function renderText(subject: ContentSubject, revision: number): string {
  const fixed = fixedText(subject, revision);
  if (fixed !== undefined) return fixed;
  if (isBinaryKind(subject.kind))
    throw new Error(`Binary content is not text: ${subject.path}`);
  const context = contextOf(subject.path);
  const layout = layouts[subject.kind as keyof typeof layouts];
  const header = layout.header(context, createRandom(mix(subject.seed, 17)));
  const versions: number[] = new Array(
    Math.max(
      1,
      Math.round((subject.bytes - header.length) / layout.blockBytes),
    ),
  ).fill(0);
  for (let current = 1; current <= revision; current += 1) {
    const change = createRandom(mix(subject.seed, current));
    const roll = change.next();
    const count = versions.length;
    if (roll < 0.2) versions.push(0);
    else if (roll < 0.3) {
      for (let index = 0; index < count; index += 1)
        if (change.chance(0.3)) versions[index] = (versions[index] ?? 0) + 1;
    } else
      for (let touched = 1 + change.int(2); touched > 0; touched -= 1) {
        const index = change.int(count);
        versions[index] = (versions[index] ?? 0) + 1;
      }
  }
  const blocks = versions.map((version, index) =>
    layout.block(createRandom(mix(subject.seed, index, version, 5)), context),
  );
  return `${header}${blocks.join(layout.separator ?? '')}${layout.footer ?? ''}`;
}

const rootIgnoreRules =
  'node_modules/\n.pnpm-store/\n.turbo/\n*.log\n.env\n.env.*\n!.env.example\ncoverage/\n.DS_Store\n';

function ignoreRules(path: string) {
  if (path === '.gitignore') return rootIgnoreRules;
  return path.startsWith('apps/')
    ? 'dist/\nbuild/\n.next/\n*.tsbuildinfo\n'
    : 'dist/\n*.tsbuildinfo\n';
}

function renderPackage(subject: ContentSubject, revision: number) {
  const random = createRandom(mix(subject.seed, 23, revision));
  const directory = subject.path.slice(0, subject.path.lastIndexOf('/'));
  const name = directory
    ? `@fieldnotes/${directory.slice(directory.lastIndexOf('/') + 1)}`
    : 'fieldnotes-workspace';
  const dependencies = new Set<string>();
  const count = 2 + (subject.seed % 6);
  const pool = createRandom(subject.seed);
  while (dependencies.size < count)
    dependencies.add(pool.pick(dependencyNames));
  const entries = [...dependencies]
    .sort()
    .map((dependency) => `    "${dependency}": "^${version(random)}"`)
    .join(',\n');
  return `{\n  "name": "${name}",\n  "version": "${1 + Math.floor(revision / 20)}.${revision % 20}.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "build": "tsc -p tsconfig.json",\n    "test": "vitest run",\n    "lint": "biome check ."\n  },\n  "dependencies": {\n${entries}\n  }\n}\n`;
}

/** Real PNG signature, IHDR, IDAT and IEND chunks with seeded pixels. */
export function renderPng(seed: number, revision: number, bytes: number) {
  const side = Math.max(1, Math.floor(Math.sqrt(bytes / 3)));
  const row = side * 3 + 1;
  const pixels = Buffer.alloc(row * side);
  let state = mix(seed, revision, 31) | 1;
  for (let y = 0; y < side; y += 1)
    for (let x = 1; x < row; x += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      pixels[y * row + x] = ((x * 3 + y * 5) & 0xff) ^ (state & 0x3f);
    }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderBinary(subject: ContentSubject, revision: number) {
  if (subject.kind === 'png')
    return renderPng(subject.seed, revision, subject.bytes);
  const random = createRandom(mix(subject.seed, revision, 37));
  const length = Math.max(64, subject.bytes);
  const data = Buffer.alloc(Math.ceil(length / 4) * 4);
  data.write('wOF2', 0, 'latin1');
  for (let index = 4; index < data.length; index += 4)
    data.writeUInt32LE(Math.floor(random.next() * 0xffffffff), index);
  return data.subarray(0, length);
}

export function renderFile(subject: ContentSubject, revision: number) {
  return isBinaryKind(subject.kind)
    ? renderBinary(subject, revision)
    : renderText(subject, revision);
}

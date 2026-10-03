import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { webDomains } from '../architecture/policy.ts';
import {
  apiCalls,
  sameRoute,
  serverRoutes,
  type ApiCall,
} from './api-calls.ts';

export type Page = { file: string; path: string };

export type Surface = {
  name: string;
  page: 'route' | 'screen';
  features: string;
  domains: readonly string[];
  pages: ((root: string) => Page[]) | undefined;
  sources: readonly string[];
  calls: (root: string) => {
    calls: ApiCall[];
    problems: string[];
    sharedSources?: readonly string[];
  };
  flows?: string;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sections = [
  'What it is',
  'How a user reaches it',
  'Driving it',
  'What proves it works',
  'Gotchas',
];
const skipped = new Set(['node_modules', 'dist', '.vite', '.turbo']);
const sourceFile = /\.(?:tsx?|css|html)$/;

const entrySchema = z.strictObject({
  route: z.string().startsWith('/').optional(),
  screen: z.string().startsWith('/').optional(),
  shell: z.literal('desktop').optional(),
  selectors: z.array(z.string().min(1)).min(1),
  tests: z.array(z.string().min(1)).min(1),
  api: z.array(
    z
      .string()
      .regex(
        /^(?:GET|POST|PUT|PATCH|DELETE) \/api\/\S*$/,
        'an api entry is METHOD /api/<path> with the route parameters the server names',
      ),
  ),
});

type Entry = z.output<typeof entrySchema> & { file: string };

function filesUnder(folder: string): string[] {
  const absolute = join(root, folder);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [folder];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory())
      return skipped.has(entry.name) ? [] : filesUnder(path);
    return [path];
  });
}

type RouteFile = { file: string; segments: string[]; index: boolean };

function routeFiles(folder: string, inside: string[] = []): RouteFile[] {
  return readdirSync(join(root, folder, ...inside), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (entry.name.startsWith('-')) return [];
    if (entry.isDirectory()) return routeFiles(folder, [...inside, entry.name]);
    if (!/\.tsx?$/.test(entry.name)) return [];
    const stem = entry.name.replace(/(?:\.lazy)?\.tsx?$/, '');
    if (inside.length === 0 && stem === '__root') return [];
    const parts = [...inside, ...stem.split('.')];
    const last = parts.at(-1);
    return [
      {
        file: [folder, ...inside, entry.name].join('/'),
        segments:
          last === 'index' || last === 'route' ? parts.slice(0, -1) : parts,
        index: last === 'index',
      },
    ];
  });
}

export function fileRoutes(folder: string): Page[] {
  const files = routeFiles(folder);
  const layout = (route: RouteFile) =>
    !route.index &&
    files.some(
      (other) =>
        other.segments.length > route.segments.length &&
        route.segments.every(
          (segment, index) => other.segments[index] === segment,
        ),
    );
  return files
    .filter((route) => !layout(route))
    .map((route) => ({
      file: route.file,
      path: `/${route.segments
        .filter(
          (segment) => !segment.startsWith('_') && !/^\(.+\)$/.test(segment),
        )
        .map((segment) => segment.replace(/_$/, ''))
        .join('/')}`,
    }));
}

const web: Surface = {
  name: 'web',
  page: 'route',
  features: '.agents/skills/web-verify/features',
  domains: [...webDomains, 'app'],
  pages: () => fileRoutes('apps/web/src/routes'),
  sources: ['apps/web/src'],
  calls: (from) =>
    apiCalls(
      from,
      ['apps/web/src', 'packages/client/src'],
      [
        /^apps\/web\/src\/features\/[^/]+\/api\.ts$/,
        /^apps\/web\/src\/shared\/(?:api|live)\/[^/]+\.ts$/,
        /^packages\/client\/src\/features\/[^/]+\/api\.ts$/,
      ],
      ['apps/web/src'],
    ),
};

const desktop: Surface = {
  name: 'desktop',
  page: 'route',
  features: '.agents/skills/desktop-verify/features',
  domains: ['app', 'projects', 'access'],
  pages: undefined,
  sources: ['apps/desktop/src', 'apps/web/src'],
  calls: () => ({ calls: [], problems: [] }),
  flows: 'apps/desktop/spec/e2e',
};

export function expoScreens(folder: string, inside: string[] = []): Page[] {
  return readdirSync(join(root, folder, ...inside), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (entry.isDirectory())
      return expoScreens(folder, [...inside, entry.name]);
    const stem = entry.name.replace(/\.(?:ios|android)?\.?tsx?$/, '');
    if (!/\.tsx?$/.test(entry.name) || stem === '_layout') return [];
    const segments = [...inside, stem].filter(
      (segment) => !/^\(.+\)$/.test(segment) && segment !== 'index',
    );
    return [
      {
        file: [folder, ...inside, entry.name].join('/'),
        path: `/${segments.join('/')}`,
      },
    ];
  });
}

const mobile: Surface = {
  name: 'mobile',
  page: 'screen',
  features: '.agents/skills/mobile-verify/features',
  domains: [...webDomains, 'app'],
  pages: () => expoScreens('apps/mobile/src/app'),
  sources: ['apps/mobile/src'],
  calls: (from) =>
    apiCalls(
      from,
      ['apps/mobile/src', 'packages/client/src'],
      [
        /^apps\/mobile\/src\/features\/[^/]+\/api\.ts$/,
        /^apps\/mobile\/src\/shared\/api\/[^/]+\.ts$/,
        /^packages\/client\/src\/features\/[^/]+\/api\.ts$/,
      ],
      ['apps/mobile/src'],
    ),
};

export const surfaces: readonly Surface[] = [web, desktop, mobile];

function frontmatter(text: string): { data: unknown; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) return { data: undefined, body: text };
  const document = parseDocument(match[1] ?? '');
  return {
    data: document.errors.length > 0 ? undefined : document.toJS(),
    body: match[2] ?? '',
  };
}

function entries(surface: Surface, problems: string[]): Entry[] {
  const folder = join(root, surface.features);
  if (!existsSync(folder)) {
    problems.push(
      `${surface.features}: the ${surface.name} feature map folder is missing`,
    );
    return [];
  }
  const name = new RegExp(
    `^(?:${surface.domains.join('|')})\\.[a-z]+(?:-[a-z]+)*\\.md$`,
  );
  const found: Entry[] = [];
  for (const file of readdirSync(folder).toSorted()) {
    if (file === 'README.md') continue;
    const at = `${surface.features}/${file}`;
    if (!name.test(file)) {
      problems.push(
        `${at}: a map file is <domain>.<capability>.md with <domain> one of ${surface.domains.join(', ')}`,
      );
      continue;
    }
    const { data, body } = frontmatter(
      readFileSync(join(folder, file), 'utf8'),
    );
    const parsed = entrySchema.safeParse(data);
    if (!parsed.success) {
      problems.push(
        `${at}: its frontmatter holds route, shell, selectors, tests and api: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || 'frontmatter'} ${issue.message}`).join('; ')}`,
      );
      continue;
    }
    const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    if (sections.some((section, index) => headings[index] !== section))
      problems.push(
        `${at}: its sections are ${sections.map((section) => `## ${section}`).join(', ')}, in that order`,
      );
    found.push({ ...parsed.data, file: at });
  }
  if (found.length === 0)
    problems.push(
      `${surface.features}: the ${surface.name} feature map is empty`,
    );
  const readme = join(folder, 'README.md');
  const index = existsSync(readme) ? readFileSync(readme, 'utf8') : '';
  for (const entry of found) {
    const file = entry.file.slice(surface.features.length + 1);
    if (!index.includes(`(${file})`))
      problems.push(
        `${surface.features}/README.md: the index links every map file, and ${file} is missing from it`,
      );
  }
  return found;
}

function surfaceProblems(
  surface: Surface,
  routes: readonly string[],
): string[] {
  const problems: string[] = [];
  const mapped = entries(surface, problems);
  const pages = surface.pages?.(root);
  if (pages !== undefined) {
    const paths = new Set(pages.map((page) => page.path));
    const pageOf = (entry: Entry) =>
      surface.page === 'screen' ? entry.screen : entry.route;
    for (const entry of mapped)
      if (
        (surface.page === 'screen' ? entry.route : entry.screen) !== undefined
      )
        problems.push(
          `${entry.file}: a ${surface.name} map file names its page as ${surface.page}`,
        );
      else if (pageOf(entry) === undefined)
        problems.push(
          `${entry.file}: ${surface.page} names the page this feature lives on`,
        );
      else if (!paths.has(pageOf(entry) ?? ''))
        problems.push(
          `${entry.file}: ${surface.page} ${pageOf(entry) ?? ''} is no page under the routes folder (${[...paths].join(', ')})`,
        );
    const named = new Set(mapped.map(pageOf));
    for (const page of pages)
      if (!named.has(page.path))
        problems.push(
          `${page.file}: it renders the page at ${page.path}, which no ${surface.name} map file names as its ${surface.page}; write the map file of a feature on that page. ${surface.page === 'screen' ? 'A _layout file needs none.' : '__root and a layout route, whose folder holds child routes and whose page is its index, need none.'}`,
        );
  }
  if (surface.flows !== undefined) {
    const named = new Set(mapped.flatMap((entry) => entry.tests));
    for (const flow of filesUnder(surface.flows))
      if (flow.endsWith('.e2e.ts') && !named.has(flow))
        problems.push(
          `${flow}: it tests a native ${surface.name} feature that no ${surface.name} map file names in its tests; add it to the tests of the map file of the feature it proves, or write that map file.`,
        );
  }
  const { calls, problems: unread, sharedSources = [] } = surface.calls(root);
  problems.push(...unread);
  const source = [...surface.sources.flatMap(filesUnder), ...sharedSources]
    .filter((file) => sourceFile.test(file))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
  for (const entry of mapped) {
    for (const selector of entry.selectors)
      if (!source.includes(selector))
        problems.push(
          `${entry.file}: selector "${selector}" appears nowhere in ${surface.sources.join(', ')}; name a test id or accessible name the app renders`,
        );
    for (const test of entry.tests)
      if (!existsSync(join(root, test)))
        problems.push(`${entry.file}: test ${test} does not exist`);
    for (const api of entry.api)
      if (!routes.includes(api))
        problems.push(
          `${entry.file}: api ${api} is no route the server registers under apps/server/src/http`,
        );
  }
  for (const entry of mapped)
    for (const api of entry.api)
      if (routes.includes(api) && !calls.some((call) => sameRoute(api, call)))
        problems.push(
          `${entry.file}: api ${api} is a route the ${surface.name} never calls from its api layer; list the routes this feature calls`,
        );
  const covered = mapped.flatMap((entry) => entry.api);
  const uncovered = new Map<string, ApiCall>();
  for (const call of calls)
    if (!covered.some((api) => sameRoute(api, call)))
      uncovered.set(`${call.method} ${call.path}`, call);
  for (const [route, call] of uncovered)
    problems.push(
      `${call.file}:${call.line}: the ${surface.name} calls ${route}: no map file lists it in its api; add it to the map of the feature that calls it`,
    );
  return problems;
}

const started = performance.now();
const routes = serverRoutes(root);
const problems = surfaces.flatMap((surface) =>
  surfaceProblems(surface, routes),
);
for (const problem of problems) process.stderr.write(`${problem}\n`);
process.stdout.write(
  `Feature maps: ${problems.length} problems across ${surfaces.map((surface) => surface.name).join(', ')} in ${Math.round(performance.now() - started)} ms.\n`,
);
process.exitCode = problems.length > 0 ? 1 : 0;

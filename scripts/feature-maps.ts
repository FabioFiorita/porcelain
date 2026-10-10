import { Schema, Result } from 'effect';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { webDomains } from '../architecture/policy.ts';
import { selectorAppears } from '../architecture/feature-selectors.ts';
import { featureApiRoutes } from './feature-api-routes.ts';
type Page = { file: string; path: string };
type Surface = {
  name: string;
  page: 'route' | 'screen';
  features: string;
  domains: readonly string[];
  pages: ((root: string) => Page[]) | undefined;
  sources: readonly string[];
  flows?: string;
};
const skipped = new Set(['node_modules', 'dist', '.vite', '.turbo']);
const sourceFile = /\.(?:tsx?|css|html)$/;
const entrySchema = Schema.Struct({
  route: Schema.optional(Schema.String.check(Schema.isStartingWith('/'))),
  screen: Schema.optional(Schema.String.check(Schema.isStartingWith('/'))),
  shell: Schema.optional(Schema.Literal('desktop')),
  selectors: Schema.Array(Schema.NonEmptyString).check(Schema.isMinLength(1)),
  tests: Schema.Array(Schema.NonEmptyString),
  api: Schema.Array(
    Schema.String.check(
      Schema.isPattern(/^(?:GET|POST|PUT|PATCH|DELETE) \/api\/\S*$/, {
        expected:
          'an api entry is METHOD /api/<path> with the route parameters the contract names',
      }),
    ),
  ),
});
type Entry = typeof entrySchema.Type & { file: string };
function filesUnder(root: string, folder: string): string[] {
  const absolute = join(root, folder);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [folder];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory())
      return skipped.has(entry.name) ? [] : filesUnder(root, path);
    return [path];
  });
}
type RouteFile = { file: string; segments: string[]; index: boolean };
function routeFiles(
  root: string,
  folder: string,
  inside: string[] = [],
): RouteFile[] {
  return readdirSync(join(root, folder, ...inside), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (entry.name.startsWith('-')) return [];
    if (entry.isDirectory())
      return routeFiles(root, folder, [...inside, entry.name]);
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
function fileRoutes(root: string, folder: string): Page[] {
  const files = routeFiles(root, folder);
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
  pages: (root) => fileRoutes(root, 'apps/web/src/routes'),
  sources: ['apps/web/src', 'packages/client/src'],
};
const desktop: Surface = {
  name: 'desktop',
  page: 'route',
  features: '.agents/skills/desktop-verify/features',
  domains: ['app', 'projects', 'access'],
  pages: undefined,
  sources: ['apps/desktop/src', 'apps/web/src', 'packages/client/src'],
  flows: 'apps/desktop/spec/e2e',
};
function expoScreens(
  root: string,
  folder: string,
  inside: string[] = [],
): Page[] {
  return readdirSync(join(root, folder, ...inside), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (entry.isDirectory())
      return expoScreens(root, folder, [...inside, entry.name]);
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
  pages: (root) => expoScreens(root, 'apps/mobile/src/app'),
  sources: ['apps/mobile/src', 'packages/client/src'],
};
const surfaces: readonly Surface[] = [web, desktop, mobile];
function frontmatter(text: string): unknown {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match === null) return undefined;
  const document = parseDocument(match[1] ?? '');
  return document.errors.length > 0 ? undefined : document.toJS();
}
function entries(root: string, surface: Surface, problems: string[]): Entry[] {
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
    const data = frontmatter(readFileSync(join(folder, file), 'utf8'));
    const parsed = Schema.decodeUnknownResult(entrySchema, {
      onExcessProperty: 'error',
      errors: 'all',
    })(data);
    if (!Result.isSuccess(parsed)) {
      problems.push(
        `${at}: its frontmatter holds route, shell, selectors, tests and api: ${parsed.failure.message}`,
      );
      continue;
    }
    if (surface.name !== 'mobile' && parsed.success.tests.length === 0) {
      problems.push(
        `${at}: its frontmatter holds at least one test, because web and desktop features have automated journeys.`,
      );
      continue;
    }
    found.push({
      ...parsed.success,
      file: at,
    });
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
  root: string,
  surface: Surface,
  routes: readonly string[],
): string[] {
  const problems: string[] = [];
  const mapped = entries(root, surface, problems);
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
    for (const flow of filesUnder(root, surface.flows))
      if (flow.endsWith('.e2e.ts') && !named.has(flow))
        problems.push(
          `${flow}: it tests a native ${surface.name} feature that no ${surface.name} map file names in its tests; add it to the tests of the map file of the feature it proves, or write that map file.`,
        );
  }
  const sources = surface.sources
    .flatMap((folder) => filesUnder(root, folder))
    .filter((file) => sourceFile.test(file))
    .map((file) => readFileSync(join(root, file), 'utf8'));
  for (const entry of mapped) {
    for (const selector of entry.selectors)
      if (!sources.some((source) => selectorAppears(source, selector)))
        problems.push(
          `${entry.file}: selector "${selector}" appears nowhere as a quoted literal or on word boundaries in ${surface.sources.join(', ')}; name a test id or accessible name the app renders so the map can drive it`,
        );
    for (const test of entry.tests)
      if (!existsSync(join(root, test)))
        problems.push(`${entry.file}: test ${test} does not exist`);
    for (const api of entry.api)
      if (!routes.includes(api))
        problems.push(
          `${entry.file}: api ${api} is no endpoint declared in packages/contracts`,
        );
  }
  return problems;
}
export function featureMapProblems(root: string): string[] {
  const routes = featureApiRoutes();
  return surfaces.flatMap((surface) => surfaceProblems(root, surface, routes));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = performance.now();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const problems = featureMapProblems(root);
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.stdout.write(
    `Feature maps: ${problems.length} problems across ${surfaces.map((surface) => surface.name).join(', ')} in ${Math.round(performance.now() - started)} ms.\n`,
  );
  process.exitCode = problems.length > 0 ? 1 : 0;
}

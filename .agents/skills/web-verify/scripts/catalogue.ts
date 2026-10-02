import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { webDomains } from '../../../../architecture/policy.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const mapFolder = resolve(
  repositoryRoot,
  '.agents/skills/web-verify/feature-map',
);
const journeyDomains = [...webDomains, 'app'];
const journeyFolder = 'apps/web/spec/browser';
const negativeFolder = 'apps/web/spec/negative';

export const shellSchema = z.enum(['web', 'desktop']);

export type Shell = z.output<typeof shellSchema>;

const journeySchema = z.strictObject({
  feature: z
    .string()
    .regex(
      new RegExp(`^(?:${journeyDomains.join('|')})\\.[a-z]+(?:-[a-z]+)*$`),
      `a journey is <domain>.<capability>, with <domain> one of ${journeyDomains.join(', ')}`,
    ),
  route: z.string().startsWith('/'),
  reach: z.string().min(1),
  shortcut: z.string().min(1).optional(),
  shell: shellSchema.default('web'),
  behaviour: z
    .string()
    .regex(
      /^[A-Z][^\n]*[^.\n]\.$/,
      'the behaviour is one sentence that starts with a capital and ends with a full stop',
    ),
  server: z.array(z.string().min(1)).min(1),
  spec: z
    .string()
    .regex(
      /^apps\/web\/spec\/browser\/[a-z0-9-]+\.browser\.ts$/,
      `the spec is ${journeyFolder}/<name>.browser.ts`,
    ),
});

export type JourneyEntry = z.input<typeof journeySchema>;

export type Journey = z.output<typeof journeySchema> & {
  claims: { id: string; routes: readonly string[] }[];
};

export type NegativeJourney = {
  name: string;
  spec: string;
  plants: string;
  rejectedWhen: RegExp;
};

export const recordedNegatives = 3;

export const negativeJourneys: readonly NegativeJourney[] = [
  {
    name: 'wrong-text',
    spec: `${negativeFolder}/wrong-text.browser.ts`,
    plants: 'a journey that waits for text the app never shows',
    rejectedWhen: /Cannot find element|expected element|to be visible/i,
  },
  {
    name: 'false-server-state',
    spec: `${negativeFolder}/false-server-state.browser.ts`,
    plants:
      'a journey whose server assertion states what the server never saved',
    rejectedWhen: /expected .* to (?:be|equal|contain)/i,
  },
  {
    name: 'console-error',
    spec: `${negativeFolder}/console-error.browser.ts`,
    plants: 'a journey during which the page reports a console error',
    rejectedWhen:
      /did not declare[\s\S]*console error: A failure the journey never declared/,
  },
];

const routeFolder = 'apps/web/src/routes';

type RouteFile = { file: string; segments: string[]; index: boolean };

function routeFiles(folder: string, inside: string[] = []): RouteFile[] {
  return readdirSync(join(repositoryRoot, folder, ...inside), {
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

export function pageRoutes(): { file: string; path: string }[] {
  const files = routeFiles(routeFolder);
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
    }))
    .toSorted((left, right) => left.file.localeCompare(right.file));
}

export function unmappedRoutes(journeys: readonly Journey[]): string[] {
  const mapped = new Set(journeys.map((journey) => journey.route));
  return pageRoutes()
    .filter((route) => !mapped.has(route.path))
    .map(
      (route) =>
        `${route.file} renders the page at ${route.path}, which no web feature map entry names as its route; give the journey that drives that page route: '${route.path}', or write one. __root and a layout route, whose folder holds child routes and whose page is its index, need none.`,
    );
}

export async function loadJourneys(): Promise<Journey[]> {
  const files = readdirSync(mapFolder)
    .filter((name) => name.endsWith('.ts'))
    .toSorted();
  const journeys: Journey[] = [];
  for (const file of files) {
    const module: unknown = await import(
      pathToFileURL(join(mapFolder, file)).href
    );
    const parsed = z.object({ default: journeySchema }).safeParse(module);
    if (!parsed.success)
      throw new Error(
        `feature-map/${file}: ${parsed.error.issues.map((issue) => `${issue.path.slice(1).join('.')}: ${issue.message}`).join('; ')}`,
      );
    const journey = parsed.data.default;
    if (journey.feature !== basename(file, '.ts'))
      throw new Error(
        `feature-map/${file} must describe the journey ${basename(file, '.ts')}`,
      );
    if (!existsSync(join(repositoryRoot, journey.spec)))
      throw new Error(
        `feature-map/${file} maps a missing browser spec: ${journey.spec}`,
      );
    journeys.push({ ...journey, claims: [] });
  }
  const specs = journeys.map((journey) => journey.spec);
  const shared = specs.filter((spec, index) => specs.indexOf(spec) !== index);
  if (shared.length > 0)
    throw new Error(
      `each browser spec belongs to one journey; ${shared.join(', ')} is mapped twice`,
    );
  for (const file of readdirSync(join(repositoryRoot, journeyFolder)))
    if (!specs.includes(`${journeyFolder}/${file}`))
      throw new Error(`${journeyFolder}/${file} has no web feature map entry`);
  const planted = readdirSync(join(repositoryRoot, negativeFolder)).toSorted();
  const named = negativeJourneys
    .map((negative) => basename(negative.spec))
    .toSorted();
  if (
    negativeJourneys.length !== recordedNegatives ||
    planted.join(',') !== named.join(',')
  )
    throw new Error(
      `negatives: ${negativeFolder} holds the ${recordedNegatives} negative journeys scripts/catalogue.ts names (${named.join(', ')}), and found ${planted.join(', ') || 'none'}; a negative leaves only with its entry and the pinned count`,
    );
  if (journeys.length === 0) throw new Error('The web feature map is empty');
  return journeys;
}

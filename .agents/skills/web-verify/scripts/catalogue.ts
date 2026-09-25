import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const mapFolder = resolve(
  repositoryRoot,
  '.agents/skills/web-verify/feature-map',
);
const specFolder = resolve(repositoryRoot, 'apps/web/spec/browser');
const featureSchema = z.strictObject({
  feature: z.string().regex(/^[a-z]+(?:[.-][a-z]+)*$/),
  path: z.string().startsWith('/'),
  behavior: z.string().min(1),
  needsPairing: z.boolean().default(false),
  spec: z.string().regex(/^apps\/web\/spec\/browser\/[a-z-]+\.browser\.ts$/),
});

export async function loadFeatures() {
  const files = readdirSync(mapFolder)
    .filter((name) => name.endsWith('.ts'))
    .toSorted();
  const features = [];
  for (const file of files) {
    const module: unknown = await import(
      pathToFileURL(join(mapFolder, file)).href
    );
    const feature = z.object({ default: featureSchema }).parse(module).default;
    if (feature.feature !== basename(file, '.ts'))
      throw new Error(`${file} must export feature ${basename(file, '.ts')}`);
    if (!existsSync(join(repositoryRoot, feature.spec)))
      throw new Error(`${file} maps a missing browser spec: ${feature.spec}`);
    features.push(feature);
  }
  const mapped = new Set(features.map((feature) => feature.spec));
  for (const file of readdirSync(specFolder))
    if (
      file.endsWith('.browser.ts') &&
      !mapped.has(`apps/web/spec/browser/${file}`)
    )
      throw new Error(`${file} has no web feature map entry`);
  if (features.length === 0) throw new Error('The web feature map is empty');
  return features;
}

import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDefinedCase, isRecord, type Feature } from './feature.ts';

const skillDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function isFeature(value: unknown): value is Feature {
  return (
    isRecord(value) &&
    typeof value.feature === 'string' &&
    (typeof value.reaches === 'string' || Array.isArray(value.reaches)) &&
    typeof value.paired === 'boolean' &&
    (value.intent === 'observed' || value.intent === 'intended') &&
    typeof value.behaviour === 'string' &&
    Array.isArray(value.cases) &&
    value.cases.every(isDefinedCase)
  );
}

export function loadFeatures(except?: string): Promise<Feature[]> {
  return loadFrom(join(skillDirectory, 'feature-map'), except);
}

export const recordedNegatives = 3;

export function loadNegatives(): Promise<Feature[]> {
  return loadFrom(join(skillDirectory, 'negative'));
}

async function loadFrom(
  directory: string,
  except?: string,
): Promise<Feature[]> {
  const files = (await readdir(directory))
    .filter((name) => name.endsWith('.ts'))
    .sort();
  const features: Feature[] = [];
  for (const file of files) {
    const location = pathToFileURL(join(directory, file)).href;
    if (location === except) continue;
    const loaded: unknown = await import(location);
    const feature = isRecord(loaded) ? loaded.default : undefined;
    if (
      isRecord(feature) &&
      Array.isArray(feature.cases) &&
      !feature.cases.every(isDefinedCase)
    )
      throw new Error(
        `${file} builds every case with defineCase; a hand-written case skips the unasserted-exchange check and the phases defineCase enters`,
      );
    if (!isFeature(feature) || `${feature.feature}.ts` !== file)
      throw new Error(
        `${file} must default-export the feature named ${file.slice(0, -3)}`,
      );
    features.push(feature);
  }
  return features;
}

export function reachesOf(feature: Feature): readonly string[] {
  return typeof feature.reaches === 'string'
    ? [feature.reaches]
    : feature.reaches;
}

import { Schema, Result } from 'effect';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export const pinsFile = 'architecture/shadcn-pins.json';
export const uiFolder = 'apps/web/src/components/ui';
const pinsSchema = Schema.Record(
  Schema.String.check(
    Schema.isPattern(/^[a-z0-9-]+\.tsx$/, {
      expected: 'each key is a components/ui file',
    }),
  ),
  Schema.String.check(
    Schema.isPattern(/^[0-9a-f]{64}$/, {
      expected: 'each value is a sha256 hex digest',
    }),
  ),
);
export type Pins = typeof pinsSchema.Type;
export function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
export function uiFiles(root: string): string[] {
  const folder = join(root, uiFolder);
  return existsSync(folder)
    ? readdirSync(folder)
        .filter((name) => name.endsWith('.tsx'))
        .toSorted()
    : [];
}
export function readPins(root: string): { pins: Pins; problems: string[] } {
  const path = join(root, pinsFile);
  if (!existsSync(path))
    return {
      pins: {},
      problems: [
        `${pinsFile} is missing, because registry ownership needs a recorded digest for each installed component.`,
      ],
    };
  try {
    const read = Schema.decodeUnknownResult(pinsSchema, {
      onExcessProperty: 'error',
    })(JSON.parse(readFileSync(path, 'utf8')));
    return Result.isSuccess(read)
      ? {
          pins: read.success,
          problems: [],
        }
      : {
          pins: {},
          problems: [
            `${pinsFile} maps each components/ui file to the sha256 of what the shadcn CLI installed: ${read.failure.message}, because malformed pins cannot detect edits to installed components.`,
          ],
        };
  } catch (error) {
    return {
      pins: {},
      problems: [
        `${pinsFile} is not strict JSON (${error instanceof Error ? error.message : String(error)}), because malformed pins cannot detect edits to installed components.`,
      ],
    };
  }
}
const repin =
  'node scripts/shadcn-pin.ts pins what the registry serves, never the file on disk';
const approval =
  'changing a pin any other way is a guard change the owner approves';
export function pinProblems(root: string): string[] {
  const { pins, problems } = readPins(root);
  if (problems.length > 0) return problems;
  const files = uiFiles(root);
  return [
    ...files.flatMap((name) => {
      const path = `${uiFolder}/${name}`;
      const pinned = pins[name];
      if (pinned === undefined)
        return [
          `${path} has no pin in ${pinsFile}; add a component only with the shadcn CLI, format it, then run ${repin}, because an unpinned component can drift from the registry without detection.`,
        ];
      return digest(readFileSync(join(root, path), 'utf8')) === pinned
        ? []
        : [
            `${path} differs from what the shadcn CLI installed; components/ui is never edited: restore it with pnpm --filter @porcelain/web exec shadcn add ${name.slice(0, -'.tsx'.length)} --overwrite --yes and the format, then compose the look in the feature view or ask the owner; ${approval}, because local edits diverge from the registry and can be lost when a component is updated.`,
          ];
    }),
    ...Object.keys(pins)
      .filter((name) => !files.includes(name))
      .map(
        (name) =>
          `${pinsFile} pins ${name}, which ${uiFolder} no longer holds; run ${repin}, because stale pins hide which installed components the guard actually protects.`,
      ),
  ];
}

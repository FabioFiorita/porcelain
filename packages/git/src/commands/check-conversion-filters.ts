import { UnsupportedGitFiltersError } from '../errors/unsupported-git-filters-error.ts';
import { executeInspection } from '../execute-inspection.ts';

export async function checkConversionFilters(
  checkout: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const config = await executeInspection(
    checkout,
    ['config', '--null', '--list'],
    1024 * 1024,
    signal,
  );
  const drivers = new Set(
    config
      .toString('utf8')
      .split('\0')
      .flatMap((entry) => {
        const match = /^filter\.(.+)\.(?:clean|smudge|process)\n[\s\S]+$/.exec(
          entry,
        );
        return match?.[1] ? [match[1]] : [];
      }),
  );
  const paths = await executeInspection(
    checkout,
    ['ls-files', '-z'],
    8 * 1024 * 1024,
    signal,
  );
  // check-attr does not run conversion drivers. stdin preserves filename bytes.
  const attributes = await executeInspection(
    checkout,
    ['check-attr', '-z', '--stdin', 'filter'],
    16 * 1024 * 1024,
    signal,
    [],
    paths,
  );
  const fields = attributes.toString('utf8').split('\0');
  const assigned = fields.filter((_, index) => index % 3 === 2);
  // A presently unconfigured assignment is also unsupported: its command can
  // be configured between this check and Git's working-file conversion.
  if (
    assigned.some(
      (driver) =>
        drivers.has(driver) ||
        !['unspecified', 'unset', 'set'].includes(driver),
    )
  )
    throw new UnsupportedGitFiltersError();
  // Disable discovered commands so an attributes edit cannot launch a known
  // driver between validation and inspection.
  // Attribute-state markers can also be literal driver names. Disable those
  // possible names too, before a concurrent configuration edit.
  return [...new Set([...drivers, ...assigned])].flatMap((driver) =>
    ['clean', 'smudge', 'process'].map(
      (operation) => `filter.${driver}.${operation}=`,
    ),
  );
}

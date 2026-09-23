import { UnsupportedGitFiltersError } from '../errors/unsupported-git-filters-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';

async function checkConversionFilters(
  checkout: string,
  signal?: AbortSignal,
  selectedPaths?: readonly string[],
): Promise<string[]> {
  const config = await runInspection(
    checkout,
    ['config', '--null', '--list'],
    signal,
    { maxBytes: 1024 * 1024 },
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
  const paths = selectedPaths
    ? Buffer.from(`${selectedPaths.join('\0')}\0`)
    : await runInspection(checkout, ['ls-files', '-z'], signal, {
        maxBytes: 8 * 1024 * 1024,
      });
  const attributes = await runInspection(
    checkout,
    ['check-attr', '-z', '--stdin', 'filter'],
    signal,
    { maxBytes: 16 * 1024 * 1024, input: paths },
  );
  const fields = attributes.toString('utf8').split('\0');
  const assigned = fields.filter((_, index) => index % 3 === 2);
  if (
    assigned.some(
      (driver) =>
        drivers.has(driver) ||
        !['unspecified', 'unset', 'set'].includes(driver),
    )
  )
    throw new UnsupportedGitFiltersError();
  return [...new Set([...drivers, ...assigned])].flatMap((driver) =>
    ['clean', 'smudge', 'process'].map(
      (operation) => `filter.${driver}.${operation}=`,
    ),
  );
}

export function sessionConversionFilters(
  session: CheckoutSession,
  signal?: AbortSignal,
): Promise<string[]> {
  return session.conversionFilters(() =>
    checkConversionFilters(session.path, signal),
  );
}

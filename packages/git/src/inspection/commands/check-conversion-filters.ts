import type { CheckoutSession } from '../interfaces/git-session.ts';
import { UnsupportedGitFiltersError } from '../errors/unsupported-git-filters-error.ts';
import {
  disabledFilterConfig,
  filterDrivers,
  parseFilterAttributes,
} from '../../shared/conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

const UNFILTERED = new Set(['unspecified', 'unset', 'set']);

export function sessionConversionFilters(
  session: CheckoutSession,
  signal?: AbortSignal,
): Promise<string[]> {
  return session.conversionFilters(() =>
    checkConversionFilters(session.path, signal),
  );
}

async function checkConversionFilters(
  checkout: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const config = await runInspection(
    checkout,
    ['config', '--null', '--list'],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  const drivers = filterDrivers(config.toString('utf8'));
  const paths = await runInspection(checkout, ['ls-files', '-z'], signal, {
    maxBytes: 8 * 1024 * 1024,
  });
  const attributes = await runInspection(
    checkout,
    ['check-attr', '-z', '--stdin', 'filter'],
    signal,
    { maxBytes: 16 * 1024 * 1024, input: paths },
  );
  const assigned = parseFilterAttributes(attributes.toString('utf8')).map(
    (record) => record.filter,
  );
  if (assigned.some((driver) => drivers.has(driver) || !UNFILTERED.has(driver)))
    throw new UnsupportedGitFiltersError();
  return disabledFilterConfig([...drivers.keys(), ...assigned]);
}

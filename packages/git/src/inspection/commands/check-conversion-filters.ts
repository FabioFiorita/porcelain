import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { UnsupportedGitFiltersError } from '../errors/unsupported-git-filters-error.ts';
import {
  disabledFilterConfig,
  filterDrivers,
  parseFilterAttributes,
} from '../../shared/parsers/conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

const UNFILTERED = new Set(['unspecified', 'unset', 'set']);

export function sessionConversionFilters(
  session: CheckoutSession,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string[]> {
  return session.conversionFilters(() =>
    checkConversionFilters(session.path, limits, signal),
  );
}

async function checkConversionFilters(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string[]> {
  const config = await runInspection(
    checkout,
    ['config', '--null', '--list'],
    limits,
    signal,
    { maxBytes: limits.inspection.filterConfigBytes },
  );
  const drivers = filterDrivers(config.toString('utf8'));
  const paths = await runInspection(
    checkout,
    ['ls-files', '-z'],
    limits,
    signal,
    { maxBytes: limits.inspection.filterPathsBytes },
  );
  const attributes = await runInspection(
    checkout,
    ['check-attr', '-z', '--stdin', 'filter'],
    limits,
    signal,
    { maxBytes: limits.inspection.filterAttributesBytes, input: paths },
  );
  const assigned = parseFilterAttributes(attributes.toString('utf8')).map(
    (record) => record.filter,
  );
  if (assigned.some((driver) => drivers.has(driver) || !UNFILTERED.has(driver)))
    throw new UnsupportedGitFiltersError();
  return disabledFilterConfig([...drivers.keys(), ...assigned]);
}

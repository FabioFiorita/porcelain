import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { UnsupportedGitFiltersError } from '../../shared/errors/unsupported-git-filters-error.ts';
import {
  disabledFilterConfig,
  filterDrivers,
  parseFilterAttributes,
} from '../../shared/parsers/conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

const UNFILTERED = new Set(['unspecified', 'unset', 'set']);

const VALUED_FILTER_PATHS = [
  'ls-files',
  '-z',
  '--',
  ':/',
  ':(exclude,attr:!filter)',
  ':(exclude,attr:-filter)',
  ':(exclude,attr:filter)',
];

export function sessionConversionFilters(
  session: EffectCheckoutSession,
  limits: GitLimits,
) {
  return session.conversionFilters(
    checkConversionFilters(session.path, limits),
  );
}

const checkConversionFilters = Effect.fn('Git.checkConversionFilters')(
  function* (checkout: string, limits: GitLimits) {
    const [config, valued] = yield* Effect.all(
      [
        runInspection(checkout, ['config', '--null', '--list'], limits, {
          maxBytes: limits.inspection.filterConfigBytes,
        }),
        runInspection(checkout, VALUED_FILTER_PATHS, limits, {
          maxBytes: limits.inspection.filterPathsBytes,
        }),
      ],
      { concurrency: 'unbounded' },
    );
    const drivers = filterDrivers(config.toString('utf8'));
    if (
      valued.length === 0 &&
      ![...drivers.keys()].some((driver) => UNFILTERED.has(driver))
    )
      return disabledFilterConfig(drivers.keys());
    const paths = yield* runInspection(checkout, ['ls-files', '-z'], limits, {
      maxBytes: limits.inspection.filterPathsBytes,
    });
    const attributes = yield* runInspection(
      checkout,
      ['check-attr', '-z', '--stdin', 'filter'],
      limits,
      { maxBytes: limits.inspection.filterAttributesBytes, input: paths },
    );
    const assigned = parseFilterAttributes(attributes.toString('utf8')).map(
      (record) => record.filter,
    );
    if (
      assigned.some((driver) => drivers.has(driver) || !UNFILTERED.has(driver))
    )
      return yield* Effect.fail(new UnsupportedGitFiltersError());
    return disabledFilterConfig([...drivers.keys(), ...assigned]);
  },
);

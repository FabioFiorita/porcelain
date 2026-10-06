import { DateTime, Result, Schema, SchemaTransformation } from 'effect';
import { WORKTREE_ID_LENGTH } from './limits.ts';

export const urlStringSchema = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      Result.isSuccess(Schema.decodeUnknownResult(Schema.URLFromString)(value)),
    { expected: 'an absolute URL' },
  ),
);

export const isoDateTimeSchema = Schema.String.check(
  Schema.isPattern(
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/,
  ),
  Schema.makeFilter(
    (value) => {
      const parsed = Schema.decodeUnknownResult(Schema.DateTimeUtcFromString)(
        value,
      );
      return (
        Result.isSuccess(parsed) &&
        DateTime.formatIsoDate(parsed.success) === value.split('T')[0]
      );
    },
    { expected: 'a valid UTC timestamp' },
  ),
);

export const projectIdSchema = Schema.String.check(Schema.isUUID());
export const worktreeIdSchema = Schema.String.check(
  Schema.isPattern(new RegExp(`^[0-9a-f]{${WORKTREE_ID_LENGTH}}$`)),
);

export function nullableAsUndefined<S extends Schema.Top>(schema: S) {
  const wire = Schema.NullOr(schema);
  return wire.pipe(
    Schema.decodeTo(
      Schema.UndefinedOr(Schema.toType(schema)),
      SchemaTransformation.transform<S['Type'] | undefined, S['Type'] | null>({
        decode: (value: typeof wire.Type) =>
          value === null ? undefined : value,
        encode: (value: S['Type'] | undefined) =>
          value === undefined ? null : value,
      }),
    ),
  );
}

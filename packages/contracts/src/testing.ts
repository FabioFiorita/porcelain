import type { z } from 'zod'

/**
 * A value that has already been parsed by a contract schema. Fixture builders never hand-author
 * a parallel TypeScript shape — they only return what the schema accepts.
 */
export type ContractFixture<Schema extends z.ZodType> = z.infer<Schema>

/**
 * Parse an untrusted fixture value against a contract schema. Invalid values throw before a
 * test can dispatch or render them.
 */
export function parseContractFixture<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): ContractFixture<Schema> {
  return schema.parse(value)
}

/**
 * Build a contract fixture by parsing `value` with `schema` at construction time.
 * Drift fails when the fixture is defined, not when a client later consumes it.
 */
export function defineContractFixture<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): ContractFixture<Schema> {
  return parseContractFixture(schema, value)
}

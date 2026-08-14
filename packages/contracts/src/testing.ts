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

/** Recursively strips `readonly` — the inverse of what `as const` does to a fixture literal. */
export type Mutable<T> = T extends readonly (infer Element)[]
  ? Mutable<Element>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

/**
 * A deep, mutable copy of a frozen fixture.
 *
 * Contract fixtures are declared `as const` so their literal shapes stay pinned, which also makes
 * every array a `readonly` tuple. Procedure inputs are inferred from Zod and are mutable, so
 * handing a fixture straight to the procedure it describes is a type error — the fixture cannot
 * be used for the thing it exists for. This copies rather than casts, so a callee that mutates
 * its input cannot reach back into the shared fixture and leak state into the next test.
 */
export function mutableFixture<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>
}

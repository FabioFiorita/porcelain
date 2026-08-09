import { z } from 'zod'

type PublicErrorDefinition<
  Code extends string,
  Category extends string,
  Retryable extends boolean,
> = {
  readonly code: Code
  readonly category: Category
  readonly retryable: Retryable
  readonly details?: never
}

type PublicErrorWithDetailsDefinition<
  Code extends string,
  Category extends string,
  Retryable extends boolean,
  Details extends z.ZodObject,
> = {
  readonly code: Code
  readonly category: Category
  readonly retryable: Retryable
  readonly details: Details
}

function createPublicErrorWithoutDetails<
  const Code extends string,
  const Category extends string,
  const Retryable extends boolean,
>(definition: PublicErrorDefinition<Code, Category, Retryable>) {
  return z
    .object({
      code: z.literal(definition.code),
      category: z.literal(definition.category),
      message: z.string(),
      retryable: z.literal(definition.retryable),
      requestId: z.uuid(),
    })
    .strict()
}

function createPublicErrorWithDetails<
  const Code extends string,
  const Category extends string,
  const Retryable extends boolean,
  Details extends z.ZodObject,
>(definition: PublicErrorWithDetailsDefinition<Code, Category, Retryable, Details>) {
  return z
    .object({
      code: z.literal(definition.code),
      category: z.literal(definition.category),
      message: z.string(),
      retryable: z.literal(definition.retryable),
      requestId: z.uuid(),
      details: definition.details,
    })
    .strict()
}

type PublicErrorWithoutDetailsSchema<
  Code extends string,
  Category extends string,
  Retryable extends boolean,
> = ReturnType<typeof createPublicErrorWithoutDetails<Code, Category, Retryable>>

type PublicErrorWithDetailsSchema<
  Code extends string,
  Category extends string,
  Retryable extends boolean,
  Details extends z.ZodObject,
> = ReturnType<typeof createPublicErrorWithDetails<Code, Category, Retryable, Details>>

function hasDetails(
  definition:
    | PublicErrorDefinition<string, string, boolean>
    | PublicErrorWithDetailsDefinition<string, string, boolean, z.ZodObject>,
): definition is PublicErrorWithDetailsDefinition<string, string, boolean, z.ZodObject> {
  return definition.details !== undefined
}

export function definePublicError<
  const Code extends string,
  const Category extends string,
  const Retryable extends boolean,
>(
  definition: PublicErrorDefinition<Code, Category, Retryable>,
): PublicErrorWithoutDetailsSchema<Code, Category, Retryable>
export function definePublicError<
  const Code extends string,
  const Category extends string,
  const Retryable extends boolean,
  Details extends z.ZodObject,
>(
  definition: PublicErrorWithDetailsDefinition<Code, Category, Retryable, Details>,
): PublicErrorWithDetailsSchema<Code, Category, Retryable, Details>
export function definePublicError(
  definition:
    | PublicErrorDefinition<string, string, boolean>
    | PublicErrorWithDetailsDefinition<string, string, boolean, z.ZodObject>,
) {
  if (hasDetails(definition)) return createPublicErrorWithDetails(definition)
  return createPublicErrorWithoutDetails(definition)
}

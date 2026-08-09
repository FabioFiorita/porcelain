import type { ServerResponse } from 'node:http'
import {
  type PorcelainError,
  type PublicErrorCategory,
  publicErrorFixtures,
  publicErrorSchema,
} from '@porcelain/contracts'
import { type TRPC_ERROR_CODE_KEY, type TRPCDefaultErrorShape, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { type ExpectedFailure, isExpectedFailure } from './expected-failure'
import { createRequestId } from './request-id'

const trpcCodesByCategory = {
  'invalid-request': 'BAD_REQUEST',
  unauthenticated: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  'not-found': 'NOT_FOUND',
  conflict: 'CONFLICT',
  unavailable: 'SERVICE_UNAVAILABLE',
  internal: 'INTERNAL_SERVER_ERROR',
} as const satisfies Record<PublicErrorCategory, TRPC_ERROR_CODE_KEY>

type PublicErrorDetails = Extract<PorcelainError, { details: object }>['details']
type PublicErrorShape = Omit<TRPCDefaultErrorShape, 'data' | 'message'> & {
  message: string
  data: Omit<TRPCDefaultErrorShape['data'], 'stack'> & { porcelain: PorcelainError }
}

export function publicErrorFor(
  code: PorcelainError['code'],
  requestId: string,
  details?: PublicErrorDetails,
): PorcelainError {
  const fixture = publicErrorFixtures[code]
  return publicErrorSchema.parse({
    ...fixture,
    requestId,
    ...(details === undefined ? {} : { details }),
  })
}

export function writePublicError(
  res: ServerResponse,
  status: number,
  corsHeaders: Record<string, string>,
  error: PorcelainError,
  extraHeaders: Record<string, string> = {},
): void {
  const body = Buffer.from(JSON.stringify(publicErrorSchema.parse(error)), 'utf8')
  res.writeHead(status, {
    ...corsHeaders,
    ...extraHeaders,
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
  })
  res.end(body)
}

function expectedFailureFrom(error: unknown): ExpectedFailure | undefined {
  if (isExpectedFailure(error)) return error
  if (error instanceof TRPCError && isExpectedFailure(error.cause)) return error.cause
  return undefined
}

function isTrpcInputValidationFailure(error: unknown): boolean {
  return (
    error instanceof TRPCError && error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
  )
}

export function toTrpcError(failure: ExpectedFailure): TRPCError {
  const error = publicErrorFor(
    failure.code,
    publicErrorFixtures[failure.code].requestId,
    failure.details,
  )
  return new TRPCError({
    code: trpcCodesByCategory[error.category],
    message: error.message,
    cause: failure,
  })
}

export function normalizePublicError(
  error: unknown,
  requestId: string,
): { error: PorcelainError; unexpected: boolean } {
  const expected = expectedFailureFrom(error)
  if (expected !== undefined) {
    return {
      error: publicErrorFor(expected.code, requestId, expected.details),
      unexpected: false,
    }
  }
  if (isTrpcInputValidationFailure(error)) {
    return { error: publicErrorFor('request.invalid', requestId), unexpected: false }
  }
  return { error: publicErrorFor('internal.unexpected', requestId), unexpected: true }
}

export function formatPublicError({
  error,
  ctx,
  shape,
}: {
  error: TRPCError
  ctx: { requestId: string } | undefined
  shape: TRPCDefaultErrorShape
}): PublicErrorShape {
  const normalized = normalizePublicError(error, ctx?.requestId ?? createRequestId())
  const { stack: _stack, ...data } = shape.data
  return {
    ...shape,
    message: normalized.error.message,
    data: { ...data, porcelain: normalized.error },
  }
}

import type { PorcelainError, PublicErrorCode } from '@porcelain/contracts'

const expectedFailureMarker = Symbol('expected failure')

type PublicErrorWithDetails = Extract<PorcelainError, { details: object }>
type PublicErrorCodeWithDetails = PublicErrorWithDetails['code']
type PublicErrorCodeWithoutDetails = Exclude<PublicErrorCode, PublicErrorCodeWithDetails>
type DetailsForCode<Code extends PublicErrorCodeWithDetails> = Extract<
  PublicErrorWithDetails,
  { code: Code }
>['details']

export type ExpectedFailure = Readonly<{
  code: PublicErrorCode
  details?: PublicErrorWithDetails['details']
  [expectedFailureMarker]: true
}>

export function expectedFailure<Code extends PublicErrorCodeWithoutDetails>(
  code: Code,
): ExpectedFailure
export function expectedFailure<Code extends PublicErrorCodeWithDetails>(
  code: Code,
  details: DetailsForCode<Code>,
): ExpectedFailure
export function expectedFailure(
  code: PublicErrorCode,
  details?: PublicErrorWithDetails['details'],
): ExpectedFailure {
  const value = details === undefined ? { code } : { code, details: Object.freeze({ ...details }) }
  return Object.freeze({ ...value, [expectedFailureMarker]: true }) as ExpectedFailure
}

export function isExpectedFailure(value: unknown): value is ExpectedFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, expectedFailureMarker) &&
    (value as ExpectedFailure)[expectedFailureMarker] === true
  )
}

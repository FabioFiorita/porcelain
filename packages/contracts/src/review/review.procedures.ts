/** Review has no live companion procedures after the Canvas cutover. */
const reviewProcedureDefinitions = {} as const

export type ReviewProcedureName = keyof typeof reviewProcedureDefinitions

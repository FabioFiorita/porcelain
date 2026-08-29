import { z } from 'zod'

/** The only structured Canvas contract accepted by Porcelain. */
export const STRUCTURED_CANVAS_VERSION = 2 as const

export const canvasFileReferenceSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(512)
      .refine(
        (path) => !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'),
        {
          message: 'must be a repository-relative path',
        },
      ),
    line: z.number().int().positive().optional(),
    label: z.string().min(1).max(120).optional(),
  })
  .strict()
export type CanvasFileReference = z.infer<typeof canvasFileReferenceSchema>

const semanticTextSchema = z.string().min(1).max(20_000)
const semanticListSchema = z.array(semanticTextSchema).max(24).default([])
const semanticRiskSchema = z
  .object({
    summary: semanticTextSchema,
    severity: z.enum(['low', 'medium', 'high']).optional(),
    mitigation: z.string().min(1).max(5_000).optional(),
  })
  .strict()

export const decisionOptionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().min(1).max(80),
    summary: semanticTextSchema,
    pros: semanticListSchema,
    cons: semanticListSchema,
    risks: z.array(semanticRiskSchema).max(16).default([]),
    effort: z.string().min(1).max(500).optional(),
    references: z.array(canvasFileReferenceSchema).max(24).default([]),
  })
  .strict()
export type DecisionOption = z.infer<typeof decisionOptionSchema>

export const decisionCriterionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    label: z.string().min(1).max(80),
    description: z.string().min(1).max(1_000).optional(),
  })
  .strict()
export type DecisionCriterion = z.infer<typeof decisionCriterionSchema>

export const decisionAssessmentSchema = z
  .object({
    optionId: z.string().min(1).max(32),
    criterionId: z.string().min(1).max(32),
    rating: z.enum(['poor', 'fair', 'good', 'strong']),
    note: z.string().min(1).max(2_000),
  })
  .strict()
export type DecisionAssessment = z.infer<typeof decisionAssessmentSchema>

export const decisionRecommendationSchema = z
  .object({
    optionId: z.string().min(1).max(32).optional(),
    summary: semanticTextSchema,
    rationale: z.array(semanticTextSchema).min(1).max(24),
    confidence: z.enum(['low', 'medium', 'high']),
    assumptions: semanticListSchema,
    changeConditions: semanticListSchema,
    references: z.array(canvasFileReferenceSchema).max(24).default([]),
  })
  .strict()
export type DecisionRecommendation = z.infer<typeof decisionRecommendationSchema>

export const recordedDecisionSchema = z
  .object({
    optionId: z.string().min(1).max(32).optional(),
    summary: semanticTextSchema,
    rationale: z.array(semanticTextSchema).max(24).default([]),
    references: z.array(canvasFileReferenceSchema).max(24).default([]),
  })
  .strict()
export type RecordedDecision = z.infer<typeof recordedDecisionSchema>

/**
 * The structured contract is semantic and presentation-free. Clients own navigation, layout, and
 * theme; authors supply decision meaning and repository references, never HTML or CSS.
 */
export const structuredCanvasDocumentSchema = z
  .object({
    version: z.literal(STRUCTURED_CANVAS_VERSION),
    template: z.literal('decision'),
    title: z.string().min(1).max(120),
    summary: semanticTextSchema,
    context: z.string().min(1).max(50_000).optional(),
    references: z.array(canvasFileReferenceSchema).max(24).default([]),
    options: z.array(decisionOptionSchema).min(2).max(6),
    criteria: z.array(decisionCriterionSchema).min(1).max(12),
    assessments: z.array(decisionAssessmentSchema).max(72),
    recommendation: decisionRecommendationSchema,
    decision: recordedDecisionSchema.optional(),
  })
  .strict()
  .superRefine((document, context) => {
    const optionIds = new Set<string>()
    document.options.forEach((option, index) => {
      if (optionIds.has(option.id)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate option id: ${option.id}`,
          path: ['options', index, 'id'],
        })
      }
      optionIds.add(option.id)
    })
    const criterionIds = new Set<string>()
    document.criteria.forEach((criterion, index) => {
      if (criterionIds.has(criterion.id)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate criterion id: ${criterion.id}`,
          path: ['criteria', index, 'id'],
        })
      }
      criterionIds.add(criterion.id)
    })
    const assessmentKeys = new Set<string>()
    document.assessments.forEach((assessment, index) => {
      if (!optionIds.has(assessment.optionId)) {
        context.addIssue({
          code: 'custom',
          message: `unknown option id: ${assessment.optionId}`,
          path: ['assessments', index, 'optionId'],
        })
      }
      if (!criterionIds.has(assessment.criterionId)) {
        context.addIssue({
          code: 'custom',
          message: `unknown criterion id: ${assessment.criterionId}`,
          path: ['assessments', index, 'criterionId'],
        })
      }
      const key = `${assessment.optionId}:${assessment.criterionId}`
      if (assessmentKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'duplicate option/criterion assessment',
          path: ['assessments', index],
        })
      }
      assessmentKeys.add(key)
    })
    for (const [path, optionId] of [
      [['recommendation', 'optionId'], document.recommendation.optionId],
      [['decision', 'optionId'], document.decision?.optionId],
    ] as const) {
      if (optionId !== undefined && !optionIds.has(optionId)) {
        context.addIssue({
          code: 'custom',
          message: `unknown option id: ${optionId}`,
          path: [...path],
        })
      }
    }
  })
export type StructuredCanvasDocument = z.infer<typeof structuredCanvasDocumentSchema>

export function structuredCanvasValidationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map(
      (issue) => `${issue.path.length === 0 ? 'document' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ')
}

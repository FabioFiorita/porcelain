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
export const decisionCanvasDocumentSchema = z
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
export type DecisionCanvasDocument = z.infer<typeof decisionCanvasDocumentSchema>

export const reviewCanvasReferenceSchema = z
  .object({
    path: canvasFileReferenceSchema.shape.path,
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    label: z.string().min(1).max(120).optional(),
  })
  .strict()
  .superRefine((reference, context) => {
    if (
      reference.startLine !== undefined &&
      reference.endLine !== undefined &&
      reference.endLine < reference.startLine
    ) {
      context.addIssue({
        code: 'custom',
        message: 'endLine must be greater than or equal to startLine',
        path: ['endLine'],
      })
    }
  })
export type ReviewCanvasReference = z.infer<typeof reviewCanvasReferenceSchema>

export const reviewCanvasSectionSchema = z
  .object({
    title: z.string().min(1).max(200),
    prose: z.string().max(32_768),
    /** Self-contained SVG markup. Clients render it only in an inert sandbox. */
    svg: z.string().min(1).max(262_144).optional(),
    /** Self-contained HTML. Clients render it only in an inert sandbox. */
    html: z.string().min(1).max(524_288).optional(),
    htmlHeight: z.number().int().min(160).max(1600).optional(),
    references: z.array(reviewCanvasReferenceSchema).max(40).default([]),
  })
  .strict()
export type ReviewCanvasSection = z.infer<typeof reviewCanvasSectionSchema>

export const reviewCanvasEvidenceCheckSchema = z
  .object({
    label: z.string().min(1).max(120),
    status: z.enum(['pass', 'fail', 'skip']),
    detail: z.string().max(400).optional(),
  })
  .strict()
export type ReviewCanvasEvidenceCheck = z.infer<typeof reviewCanvasEvidenceCheckSchema>

const canvasAssetPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !/^[a-z]:\//i.test(path) &&
      !path.includes('\\') &&
      !path.split('/').includes('..'),
    { message: 'must be a bundle-relative path' },
  )

const reviewCanvasBundledAssetSchema = z
  .object({
    kind: z.enum(['image', 'video', 'document']),
    path: canvasAssetPathSchema,
    label: z.string().min(1).max(120),
    mime: z.string().min(1).max(120).optional(),
  })
  .strict()

const reviewCanvasLinkAssetSchema = z
  .object({
    kind: z.literal('link'),
    href: z
      .string()
      .url()
      .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
        message: 'must use http or https',
      }),
    label: z.string().min(1).max(120),
  })
  .strict()

export const reviewCanvasAssetSchema = z.discriminatedUnion('kind', [
  reviewCanvasBundledAssetSchema,
  reviewCanvasLinkAssetSchema,
])
export type ReviewCanvasAsset = z.infer<typeof reviewCanvasAssetSchema>

export const reviewCanvasEvidenceSchema = z
  .object({
    title: z.string().min(1).max(200).default('Evidence'),
    checks: z.array(reviewCanvasEvidenceCheckSchema).max(32).default([]),
    assets: z.array(reviewCanvasAssetSchema).max(60).default([]),
  })
  .strict()
export type ReviewCanvasEvidence = z.infer<typeof reviewCanvasEvidenceSchema>

const canonicalReviewCanvasDocumentSchema = z
  .object({
    version: z.literal(STRUCTURED_CANVAS_VERSION),
    template: z.literal('review'),
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(4096).optional(),
    sections: z.array(reviewCanvasSectionSchema).min(1).max(30),
    evidence: reviewCanvasEvidenceSchema.optional(),
  })
  .strict()
  .superRefine((document, context) => {
    const titles = new Set<string>()
    document.sections.forEach((section, index) => {
      if (titles.has(section.title)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate section title: ${section.title}`,
          path: ['sections', index, 'title'],
        })
      }
      titles.add(section.title)
    })
  })

/**
 * Review v2 originally persisted only `why` and `how`. Normalize those documents at every
 * contract boundary so existing Canvas bundles keep rendering while all consumers see the one
 * current, ordered-section model.
 */
function normalizeLegacyReviewCanvas(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (
    record.template !== 'review' ||
    record.sections !== undefined ||
    typeof record.why !== 'string' ||
    typeof record.how !== 'string'
  ) {
    return value
  }
  const { why, how, ...current } = record
  const withoutDuplicateHeading = (content: string, heading: 'Why' | 'How'): string =>
    content.replace(new RegExp(`^#{1,6}\\s+${heading}\\s*\\r?\\n`, 'i'), '')
  return {
    ...current,
    sections: [
      { title: 'Why', prose: withoutDuplicateHeading(why, 'Why') },
      { title: 'How', prose: withoutDuplicateHeading(how, 'How') },
    ],
  }
}

export const reviewCanvasDocumentSchema = z.preprocess(
  normalizeLegacyReviewCanvas,
  canonicalReviewCanvasDocumentSchema,
)
export type ReviewCanvasDocument = z.infer<typeof reviewCanvasDocumentSchema>

/** Version 2 is the only accepted structured contract; templates are semantic discriminants. */
export const structuredCanvasDocumentSchema = z.preprocess(
  normalizeLegacyReviewCanvas,
  z.discriminatedUnion('template', [
    decisionCanvasDocumentSchema,
    canonicalReviewCanvasDocumentSchema,
  ]),
)
export type StructuredCanvasDocument = z.infer<typeof structuredCanvasDocumentSchema>

export function structuredCanvasValidationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map(
      (issue) => `${issue.path.length === 0 ? 'document' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ')
}

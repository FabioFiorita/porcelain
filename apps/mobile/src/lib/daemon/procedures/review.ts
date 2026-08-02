import { z } from 'zod'

import { defineQuery } from '../procedure'

/** The Changes shell only needs to know whether the agent published a Review and its title. */
const featureViewSummarySchema = z.object({ name: z.string() }).nullable()

export type FeatureViewSummary = z.infer<typeof featureViewSummarySchema>

export const featureViewQuery = defineQuery<string, FeatureViewSummary>(
  'featureView',
  featureViewSummarySchema,
)

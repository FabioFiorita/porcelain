import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'the read_review MCP tool calls run on its use case instead of execute',
  gate: 'lint',
  rule: 'porcelain(mcp-tool-handler)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/mcp/review-server.ts',
      old: 'useCases.reviews.readPublishedReviewAtPath.execute(',
      new: 'useCases.reviews.readPublishedReviewAtPath.run(',
    },
  ],
} satisfies Probe;

/**
 * PROPOSED in full (server review, sections 3 and 4). Replaces reviewed-files.ts.
 * In a review the reviewer ticks a layer; in plain Changes (and for "Not explained"
 * code) a file. A mark stores the fingerprint the client showed, and the server
 * reports it `stale` once the code moves on, so a later edit clears the tick.
 * Marking is a database write; marks on committed code are ignored and cleaned up.
 *
 * GET /worktrees/:worktreeId/marks, PUT /worktrees/:worktreeId/marks. "Mark all" is
 * one request.
 */

export type MarkTarget =
  | { kind: 'layer'; layerId: string }
  | { kind: 'file'; path: string };

export type ReviewedMark = {
  target: MarkTarget;
  fingerprint: string;
  reviewedAt: string;
  stale: boolean;
};

export type MarksResponse = { worktreeId: string; marks: ReviewedMark[] };

export type SetMarksRequest = {
  marks: { target: MarkTarget; reviewed: boolean; fingerprint: string }[];
};

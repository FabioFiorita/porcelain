import type { Review } from '../models/review.ts';
import type {
  ComparisonUnknown,
  ReviewComparison,
  ReviewComparisonContext,
} from '../models/review-comparison.ts';

function delta<A>(
  from: readonly A[],
  to: readonly A[],
  key: (value: A) => string,
) {
  const old = new Set(from.map(key));
  const next = new Set(to.map(key));
  return {
    added: to.filter((value) => !old.has(key(value))),
    dropped: from.filter((value) => !next.has(key(value))),
  };
}

export function compareReviewRevisions(
  from: Review,
  to: Review,
  { marks, threads }: ReviewComparisonContext,
): ReviewComparison {
  const oldFiles = new Map(from.files.map((file) => [file.path, file]));
  const newFiles = new Map(to.files.map((file) => [file.path, file]));
  const files = [...new Set([...oldFiles.keys(), ...newFiles.keys()])]
    .sort()
    .map((path) => {
      const old = oldFiles.get(path);
      const next = newFiles.get(path);
      if (old === undefined) return { path, change: 'entered' } as const;
      if (next === undefined) return { path, change: 'left' } as const;
      const headChanged = old.newOid !== next.newOid;
      const baseChanged = old.oldOid !== next.oldOid;
      const change = headChanged || baseChanged ? 'changed' : 'unchanged';
      return { path, change, headChanged, baseChanged } as const;
    });
  const changedPaths = new Set(
    files
      .filter((file) => file.change === 'changed' || file.change === 'entered')
      .map((file) => file.path),
  );
  const oldLayers = new Map(from.layers.map((layer) => [layer.id, layer]));
  const newLayers = new Map(to.layers.map((layer) => [layer.id, layer]));
  const unknown: ComparisonUnknown[] = [];
  const carried: { path: string; headBlobOid: string }[] = [];
  const reset: { path: string; headBlobOid: string }[] = [];
  for (const mark of marks.files) {
    if (!newFiles.has(mark.path)) {
      unknown.push({
        area: 'file-marks',
        reason:
          'The marked path is absent from the target manifest; its head blob may still exist unchanged.',
        ids: [mark.path],
      });
      continue;
    }
    const key = { path: mark.path, headBlobOid: mark.fingerprint };
    if (newFiles.get(mark.path)?.newOid === mark.fingerprint) carried.push(key);
    else reset.push(key);
  }
  const agentMessages: {
    threadId: string;
    messageId: string;
    body: string;
    createdAt: string;
  }[] = [];
  for (const thread of threads) {
    for (const message of thread.messages) {
      if (message.author !== 'agent') continue;
      if (
        message.createdAt === undefined ||
        !Number.isFinite(Date.parse(message.createdAt))
      ) {
        unknown.push({
          area: 'conversation',
          reason: 'An agent message has no usable creation timestamp.',
          ids: [thread.id, message.id],
        });
      } else if (Date.parse(message.createdAt) > Date.parse(from.publishedAt)) {
        agentMessages.push({
          threadId: thread.id,
          messageId: message.id,
          body: message.body,
          createdAt: message.createdAt,
        });
      }
    }
  }
  const resolvedThreadIds = threads
    .filter((thread) => thread.resolved)
    .map((thread) => thread.id);
  const oldChecks = from.proof?.checks ?? [];
  const publishedChecks = to.proof?.checks ?? [];
  const checkKey = (check: (typeof oldChecks)[number]) =>
    JSON.stringify([check.name, check.layerId, check.stepId]);
  const changedResults: ReviewComparison['proof']['changedResults'][number][] =
    [];
  for (const key of new Set(publishedChecks.map(checkKey))) {
    const before = oldChecks.filter((check) => checkKey(check) === key);
    const after = publishedChecks.filter((check) => checkKey(check) === key);
    if (before.length > 1 || after.length > 1) {
      unknown.push({
        area: 'proof',
        reason:
          'Check names and targets are not unique; the result delta is unknown.',
        ids: [key],
      });
      continue;
    }
    const old = before[0];
    const next = after[0];
    if (old !== undefined && next !== undefined && old.result !== next.result)
      changedResults.push({ from: old, to: next });
  }
  return {
    files,
    decisions: {
      affected: to.layers
        .filter(
          (layer) =>
            oldLayers.get(layer.id)?.fingerprint !== layer.fingerprint ||
            layer.steps.some(
              (step) =>
                step.kind === 'changed' && changedPaths.has(step.pointer.path),
            ),
        )
        .map((layer) => layer.id),
      new: to.layers
        .filter((layer) => !oldLayers.has(layer.id))
        .map((layer) => layer.id),
      gone: from.layers
        .filter((layer) => !newLayers.has(layer.id))
        .map((layer) => layer.id),
      resetMarks: marks.decisions
        .filter(
          (mark) =>
            newLayers.get(mark.layerId)?.fingerprint !== mark.fingerprint,
        )
        .map(({ layerId, fingerprint }) => ({ layerId, fingerprint })),
    },
    fileMarks: { carriedCount: carried.length, carried, reset },
    verdict: {
      recommendation: {
        from: from.verdict.recommendation,
        to: to.verdict.recommendation,
      },
      removed: delta(from.verdict.removed, to.verdict.removed, (entry) =>
        JSON.stringify([entry.behavior, entry.why, [...entry.paths].sort()]),
      ),
      deletedFiles: delta(
        from.files
          .filter((file) => file.status === 'deleted')
          .map((file) => file.path),
        to.files
          .filter((file) => file.status === 'deleted')
          .map((file) => file.path),
        (path) => path,
      ),
      notProven: delta(from.verdict.notProven, to.verdict.notProven, (entry) =>
        JSON.stringify([entry.what, entry.why]),
      ),
    },
    conversation: {
      agentMessageCount: agentMessages.length,
      agentThreadIds: [
        ...new Set(agentMessages.map((message) => message.threadId)),
      ],
      agentMessages,
      resolvedThreadCount: resolvedThreadIds.length,
      resolvedThreadIds,
    },
    proof: { publishedChecks, changedResults },
    unknown,
  };
}

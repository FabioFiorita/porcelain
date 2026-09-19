import type { ReviewLayer } from '../../contracts/review';
import {
  fileState,
  layerState,
  type Marks,
  type ReviewScope,
} from '../../domain/review';
import { type SetMark, useSetMarks } from '../../query/marks';
import { notifySuccess, reportFailure } from '../workspace/notify';

/** A changed file as the tick sees it: the fingerprint comes from the list of changes. */
export type TickableFile = { path: string; fingerprint: string };

/**
 * Ticks. In a review the reviewer ticks layers; in plain Changes (and for code no
 * step explains) files. A tick stores the fingerprint that was on screen, so a
 * stale tick re-ticks against the code as it is now.
 */
export function useMarkActions(scope: ReviewScope, marks: Marks) {
  const set = useSetMarks(scope);
  const fileMark = (file: TickableFile, reviewed: boolean): SetMark => ({
    target: { kind: 'file', path: file.path },
    reviewed,
    fingerprint: file.fingerprint,
  });
  return {
    isPending: set.isPending,
    toggleFile: (file: TickableFile) => {
      const reviewed = fileState(marks, file.path) !== 'reviewed';
      reportFailure(
        set.submit([fileMark(file, reviewed)]),
        'The reviewed mark was not saved',
      );
    },
    /** "Mark all reviewed" is one request. */
    setFiles: (files: readonly TickableFile[], reviewed: boolean) => {
      const changes = files.filter(
        (file) => (fileState(marks, file.path) === 'reviewed') !== reviewed,
      );
      if (changes.length === 0) return;
      const count = `${changes.length} file${changes.length === 1 ? '' : 's'}`;
      reportFailure(
        set
          .submit(changes.map((file) => fileMark(file, reviewed)))
          .then(() =>
            notifySuccess(
              reviewed
                ? `Marked ${count} reviewed`
                : `Cleared the mark on ${count}`,
            ),
          ),
        'The reviewed marks were not saved',
      );
    },
    toggleLayer: (layer: ReviewLayer) => {
      const reviewed = layerState(marks, layer) !== 'reviewed';
      reportFailure(
        set.submit([
          {
            target: { kind: 'layer', layerId: layer.id },
            reviewed,
            fingerprint: layer.fingerprint,
          },
        ]),
        'The reviewed mark was not saved',
      );
    },
  };
}

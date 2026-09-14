import type { FileContents } from '@pierre/diffs';
import { File, PatchDiff, Virtualizer } from '@pierre/diffs/react';
import { useMemo } from 'react';
import {
  createPierreDiffOptions,
  createPierreFileOptions,
} from '../../lib/pierre';
import { usePreferences } from '../workspace/preferences';
import { useTheme } from '../workspace/theme';

export function SourcePreview({
  path,
  contents,
}: {
  path: string;
  contents: string;
}) {
  const { dark } = useTheme();
  const { preferences } = usePreferences();
  const file = useMemo<FileContents>(
    () => ({ name: path, contents }),
    [path, contents],
  );
  const options = useMemo(
    () =>
      createPierreFileOptions(dark ? 'dark' : 'light', {
        overflow: preferences.lineOverflow,
      }),
    [dark, preferences.lineOverflow],
  );

  return (
    <section aria-label="Read-only code" className="pierre-preview">
      <Virtualizer className="pierre-preview-scroll">
        <File file={file} options={options} />
      </Virtualizer>
    </section>
  );
}

export function DiffPreview({ patch }: { patch: string }) {
  const { dark } = useTheme();
  const { preferences } = usePreferences();
  const options = useMemo(
    () =>
      createPierreDiffOptions(dark ? 'dark' : 'light', {
        diffStyle: preferences.diffStyle,
        overflow: preferences.lineOverflow,
      }),
    [dark, preferences.diffStyle, preferences.lineOverflow],
  );

  if (!patch.trim())
    return (
      <section aria-label="Read-only diff" className="pierre-preview-empty">
        No textual changes remain.
      </section>
    );

  return (
    <section aria-label="Read-only diff" className="pierre-preview">
      <Virtualizer className="pierre-preview-scroll">
        <PatchDiff patch={patch} options={options} />
      </Virtualizer>
    </section>
  );
}
